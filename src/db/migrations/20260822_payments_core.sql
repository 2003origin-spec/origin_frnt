-- Razorpay payments — core money ledger (USER database).
-- Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §5.1 (Phase 1).
--
-- Creates the `payments` schema: our order records, individual captured charges,
-- refunds, the unified webhook event ledger (raw payload retained so any event is
-- replayable), the transactional outbox for side effects, and the durable
-- idempotency-key store.
--
-- Purely additive and idempotent — touches no existing table. Mirrored by the
-- runtime-ensure in src/server/payments/payments-schema.ts.

CREATE SCHEMA IF NOT EXISTS payments;

-- ── Enums ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE payments.order_status AS ENUM (
    'created', 'attempted', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payments.order_kind AS ENUM (
    'subject_term', 'bundle_term', 'institute_offering',
    'subject_subscription', 'batch_subscription'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Orders: our record of an intent to charge ────────────────────────────────
CREATE TABLE IF NOT EXISTS payments.orders (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  kind                payments.order_kind NOT NULL,
  subject             TEXT,
  bundle_id           TEXT,
  workspace_id        TEXT,
  offering_id         TEXT,
  term_months         INTEGER NOT NULL DEFAULT 1 CHECK (term_months > 0),
  base_amount_minor   INTEGER NOT NULL CHECK (base_amount_minor >= 0),
  discount_minor      INTEGER NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  coupon_code         TEXT,
  razorpay_order_id   TEXT,
  status              payments.order_status NOT NULL DEFAULT 'created',
  livemode            BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key     TEXT,
  failure_reason      TEXT,
  notes               JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_orders_rzp
  ON payments.orders(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_orders_idem
  ON payments.orders(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_orders_user
  ON payments.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_orders_status
  ON payments.orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_orders_livemode
  ON payments.orders(livemode, paid_at);

-- ── Payments: individual captured charges (Rail A orders + Rail B invoices) ──
CREATE TABLE IF NOT EXISTS payments.payments (
  razorpay_payment_id   TEXT PRIMARY KEY,
  order_id              TEXT REFERENCES payments.orders(id) ON DELETE SET NULL,
  subscription_id       TEXT,
  razorpay_invoice_id   TEXT,
  user_id               TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  amount_minor          INTEGER NOT NULL CHECK (amount_minor >= 0),
  amount_refunded_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_refunded_minor >= 0),
  currency              TEXT NOT NULL DEFAULT 'INR',
  method                TEXT,
  status                TEXT NOT NULL,
  fee_minor             INTEGER,
  tax_minor             INTEGER,
  livemode              BOOLEAN NOT NULL DEFAULT FALSE,
  captured_at           TIMESTAMPTZ,
  raw                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_payments_user
  ON payments.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payments_order
  ON payments.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payments_sub
  ON payments.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_payments_rev
  ON payments.payments(livemode, captured_at) WHERE status = 'captured';

-- ── Refunds ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments.refunds (
  razorpay_refund_id  TEXT PRIMARY KEY,
  razorpay_payment_id TEXT NOT NULL
                        REFERENCES payments.payments(razorpay_payment_id) ON DELETE CASCADE,
  amount_minor        INTEGER NOT NULL CHECK (amount_minor >= 0),
  is_full             BOOLEAN NOT NULL DEFAULT FALSE,
  status              TEXT NOT NULL,
  reason              TEXT,
  initiated_by        TEXT,
  livemode            BOOLEAN NOT NULL DEFAULT FALSE,
  raw                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_refunds_payment
  ON payments.refunds(razorpay_payment_id);

-- ── Unified webhook event ledger (raw payload retained ⇒ replayable) ─────────
CREATE TABLE IF NOT EXISTS payments.events (
  event_id        TEXT PRIMARY KEY,
  event_type      TEXT,
  entity_id       TEXT,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processed', 'failed', 'ignored', 'orphaned')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  livemode        BOOLEAN NOT NULL DEFAULT FALSE,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_events_pending
  ON payments.events(status, next_attempt_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_payments_events_entity
  ON payments.events(entity_id);

-- ── Transactional outbox (side effects: mail, notifications, rollups) ───────
CREATE TABLE IF NOT EXISTS payments.outbox (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  dispatched_via  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_outbox_pending
  ON payments.outbox(status, next_attempt_at) WHERE status IN ('pending', 'failed');

-- ── Durable idempotency records (Redis is the fast path; this is the truth) ──
CREATE TABLE IF NOT EXISTS payments.idempotency_keys (
  key          TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  endpoint     TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response     JSONB,
  status_code  INTEGER,
  state        TEXT NOT NULL DEFAULT 'in_flight'
                 CHECK (state IN ('in_flight', 'completed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_payments_idem_expiry
  ON payments.idempotency_keys(expires_at);

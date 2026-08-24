/**
 * Idempotent runtime ensure for the `payments` money ledger.
 * Canonical SQL: src/db/migrations/20260822_payments_core.sql
 *
 * Mirrors the migration byte-for-byte in effect so an un-migrated dev/preview
 * database self-heals on first use — the same safety-net pattern as
 * ensureSubscriptionsSchema / ensureContestSchema. When the migration changes,
 * change both.
 *
 * Also self-heals the two GUARDED cross-schema changes that the migrations skip
 * on a database where their prerequisite tables did not yet exist:
 *   • entitlements.subject_grants — 'paid_order' source + order_id
 *     (owned by src/server/connect/subject-grants-schema.ts)
 *   • pricing.* lifecycle/MRP columns
 *     (owned by src/server/pricing/pricing-schema.ts)
 * Both are called through their own ensure functions rather than duplicated here,
 * so there is exactly one definition of each table.
 *
 * Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §5.1 (Phase 1).
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { ensureUserSchema } from "@/server/db-users";

declare global {
  var __originPaymentsSchemaEnsured: boolean | undefined;
  var __originPaymentsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260822_payments_core";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** The payments.* DDL, identical in effect to the canonical migration. */
const PAYMENTS_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS payments;

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
  dispute_id            TEXT,
  disputed_at           TIMESTAMPTZ,
  dispute_status        TEXT,
  dispute_raw           JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments.payments
  ADD COLUMN IF NOT EXISTS dispute_id TEXT,
  ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_status TEXT,
  ADD COLUMN IF NOT EXISTS dispute_raw JSONB;

CREATE INDEX IF NOT EXISTS idx_payments_payments_user
  ON payments.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payments_order
  ON payments.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payments_sub
  ON payments.payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_payments_rev
  ON payments.payments(livemode, captured_at) WHERE status = 'captured';
CREATE INDEX IF NOT EXISTS idx_payments_payments_dispute
  ON payments.payments(disputed_at) WHERE disputed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_orders_reconcile
  ON payments.orders(status, created_at) WHERE status IN ('created', 'attempted');

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
`;

export async function ensurePaymentsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originPaymentsSchemaEnsured) return;
  if (!globalThis.__originPaymentsSchemaPromise) {
    globalThis.__originPaymentsSchemaPromise = (async () => {
      // origin_users must exist before the FKs below can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        // Serialise the DDL across connections: `CREATE TABLE IF NOT EXISTS` is
        // not atomic against a concurrent creator, so two cold lambdas hitting
        // an un-migrated database race and one fails on pg_type's unique index.
        // Transaction-scoped, so it is released by COMMIT/ROLLBACK either way.
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        await client.query(PAYMENTS_SCHEMA_SQL);
        // ensureUserSchema() creates the `app` schema but NOT app.migrations —
        // that table is only created by store-postgres/platform-settings, which
        // may not have run yet on a genuinely fresh database. Create it here so
        // the ledger record below cannot throw and roll the whole ensure back.
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [MIGRATION_ID, "razorpay payments money ledger"],
        );
        await client.query("COMMIT");
        globalThis.__originPaymentsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originPaymentsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originPaymentsSchemaPromise;
}

/**
 * The payments ledger PLUS the two cross-schema surfaces a paid order writes to.
 * Call this from any code path that grants entitlement from a payment; call the
 * cheaper `ensurePaymentsSchema()` when only the ledger is touched.
 */
export async function ensurePaymentsAndGrantSchema(): Promise<void> {
  const [{ ensureSubjectGrantsSchema }, { ensurePricingSchema }] = await Promise.all([
    import("@/server/connect/subject-grants-schema"),
    import("@/server/pricing/pricing-schema"),
  ]);
  await ensurePaymentsSchema();
  await ensureSubjectGrantsSchema();
  await ensurePricingSchema();
}

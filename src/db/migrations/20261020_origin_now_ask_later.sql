-- 20261020_origin_now_ask_later: "Ask later" (decision B94): doubts answered in
-- writing without a live call, and the link from a report to the doubt it is
-- about. New table + one nullable column; idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

CREATE TABLE IF NOT EXISTS now.later_requests (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  chapter TEXT,
  difficulty TEXT NOT NULL,
  context_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,
  photo_keys TEXT[] NOT NULL DEFAULT '{}',
  price_coins INTEGER NOT NULL CHECK (price_coins > 0),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'claimed', 'answered', 'accepted', 'disputed', 'expired', 'cancelled')),
  helper_id TEXT REFERENCES now.helpers(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  answer_text TEXT,
  answer_photo_keys TEXT[] NOT NULL DEFAULT '{}',
  answered_at TIMESTAMPTZ,
  stars INTEGER CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  tip_coins INTEGER NOT NULL DEFAULT 0 CHECK (tip_coins >= 0),
  settled_at TIMESTAMPTZ,
  settle_outcome TEXT CHECK (settle_outcome IS NULL OR settle_outcome IN ('paid', 'refunded')),
  expires_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_later_requests_queue ON now.later_requests(status, subject, created_at);
CREATE INDEX IF NOT EXISTS idx_later_requests_student ON now.later_requests(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_later_requests_helper ON now.later_requests(helper_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_later_requests_idempotency ON now.later_requests(student_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
ALTER TABLE now.reports ADD COLUMN IF NOT EXISTS later_request_id TEXT REFERENCES now.later_requests(id) ON DELETE SET NULL;

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_ask_later', 'origin now: ask later (written answers)')
  ON CONFLICT (id) DO NOTHING;

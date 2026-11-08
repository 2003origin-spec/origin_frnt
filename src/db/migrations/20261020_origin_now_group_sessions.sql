-- 20261020_origin_now_group_sessions: group sessions (decision B95): a solver's
-- scheduled session on a chapter, the seats students book with coins, and
-- the link from a report to the session. New tables + one nullable column;
-- idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

CREATE TABLE IF NOT EXISTS now.group_sessions (
  id TEXT PRIMARY KEY,
  helper_id TEXT NOT NULL REFERENCES now.helpers(id),
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes BETWEEN 20 AND 45),
  seats INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 15),
  price_coins INTEGER NOT NULL CHECK (price_coins > 0),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
  solver_joined_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_by TEXT,
  mic_seat_id TEXT,
  settled_at TIMESTAMPTZ,
  settle_outcome TEXT CHECK (settle_outcome IS NULL OR settle_outcome IN ('paid', 'refunded')),
  cancel_reason TEXT,
  recording_key TEXT,
  recording_egress_id TEXT,
  recording_deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_sessions_upcoming ON now.group_sessions(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_group_sessions_helper ON now.group_sessions(helper_id, starts_at);
CREATE TABLE IF NOT EXISTS now.group_seats (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES now.group_sessions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'paid', 'refunded')),
  price_coins INTEGER NOT NULL CHECK (price_coins > 0),
  joined_at TIMESTAMPTZ,
  stars INTEGER CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_seats_active ON now.group_seats(group_id, student_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_group_seats_student ON now.group_seats(student_id, booked_at DESC);
ALTER TABLE now.reports ADD COLUMN IF NOT EXISTS group_session_id TEXT REFERENCES now.group_sessions(id) ON DELETE SET NULL;

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_group_sessions', 'origin now: group sessions')
  ON CONFLICT (id) DO NOTHING;

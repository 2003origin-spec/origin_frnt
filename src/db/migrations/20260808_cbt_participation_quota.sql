-- CBT participation quota — admin-set caps for CBT teachers — 2026-08-08
-- Plan: V1/CBT_PARTICIPATION_QUOTA_PLAN.md
--
-- WHAT THIS ADDS
--   • teachers.participation_quota  — the ADMIN cap on cumulative participations
--     for this CBT teacher. NULL = UNLIMITED, which is the grandfather rule:
--     every existing teacher keeps working untouched until an admin sets a
--     quota, because every enforcement branch is `quota IS NOT NULL AND …`.
--     (Same mechanism as app.teacher_workspaces.student_quota.)
--   • teachers.quota_updated_at     — when an admin last changed the cap.
--   • teachers.quota_notified_at    — dedupe for the "your limit is full"
--     notification. Compared against the CURRENT cycle start, so a renewal
--     re-arms it automatically; an admin raising the cap clears it too.
--   • teachers.quota_reset_mode     — how the allowance renews:
--     'none' (a lifetime cap), 'monthly' (calendar month, on the anchor's
--     day-of-month), or 'days' (every quota_period_days days). CBT is sold as a
--     subscription, so 'monthly' is the normal setting.
--   • teachers.quota_period_days    — cycle length for mode 'days'.
--   • teachers.quota_period_anchor  — the IMMUTABLE cycle anchor (the date the
--     admin picks as the subscription start). Every window is computed from this
--     anchor, never from the previous window, so a cycle anchored on the 31st
--     keeps landing on the 31st instead of drifting earlier through February.
--
-- HOW THE RESET WORKS — nothing is reset
--   The current window [start, end) is DERIVED from (anchor, mode, days, now)
--   at read time, and `used` counts only ledger rows with
--   counted_at >= window start. So the counter "returns to 0" simply because
--   wall-clock time crossed a boundary. There is no reset job that could fail,
--   no stored window that could drift, and no race between two requests both
--   trying to roll a teacher forward. Historical rows stay on the ledger for
--   audit — they just fall outside the counting window.
--   • cbt.participation_ledger      — the APPEND-ONLY meter. One row per
--     participant who actually started a test (room_participants.entered_test_at
--     stamped). PRIMARY KEY (participant_id) IS the idempotency mechanism: a
--     rejoin / resume / reclaim / second device can never double-count.
--   • cbt.participation_requests    — the teacher→admin "I need more" ledger,
--     mirroring app.teacher_code_requests including the one-open-request
--     partial unique index.
--
-- WHY THE LEDGER HAS NO FOREIGN KEY TO rooms / room_participants
--   cbt.rooms has a teacher-facing DELETE (DELETE /api/cbt/rooms/[roomId]) and
--   cbt.room_participants is ON DELETE CASCADE. If usage were derived by
--   counting participant rows, any teacher could reset their own consumption by
--   deleting a room. The ledger deliberately outlives both tables, so the
--   room_name / display_name / student_code snapshots are the only record of
--   what a row refers to once a room is gone. teacher_id keeps its FK (a
--   cbt.teachers row is disabled, never deleted, so CASCADE never fires in
--   practice).
--
-- LOCK / LOAD BUDGET — this file must stay O(1) on Neon.
--   It runs inside the Vercel `prebuild` step (scripts/run-migrations.mjs) as
--   ONE implicit transaction while production traffic is live, so it contains
--   ONLY catalog-level operations: ADD COLUMN with no default (or a constant
--   one) is metadata-only on PG 11+, and the CREATE TABLE / CREATE INDEX
--   statements build empty relations.
--
--   Deliberately NOT here:
--     · a backfill of the ledger from existing entered_test_at rows. Historical
--       participations are NOT charged against the first quota an admin sets —
--       a teacher must not be born exhausted. Metering starts at deploy time.
--       (The drain's reconcile sweep only fills rows for participants in rooms
--       that are still live, so it cannot retro-charge closed history either.)
--     · CREATE INDEX CONCURRENTLY. Both indexes are on brand-new empty tables,
--       so the plain form is instant and safe inside the transaction.
--
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE cbt.teachers
  ADD COLUMN IF NOT EXISTS participation_quota INTEGER,
  ADD COLUMN IF NOT EXISTS quota_updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quota_notified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quota_reset_mode    TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS quota_period_days   INTEGER,
  ADD COLUMN IF NOT EXISTS quota_period_anchor TIMESTAMPTZ;

-- Both CHECKs are added NOT VALID so the catalog change is instant. They are
-- enforced for every new/updated row, and there is nothing to validate: the new
-- columns start entirely NULL / 'none'.
--   · A quota of 0 would mean "blocked forever", which is what disabling the
--     teacher is for; NULL is the way to express "no cap".
--   · A renewing mode is meaningless without an anchor to renew from, and mode
--     'days' is meaningless without a length.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cbt_teachers_participation_quota_check'
  ) THEN
    ALTER TABLE cbt.teachers
      ADD CONSTRAINT cbt_teachers_participation_quota_check
      CHECK (participation_quota IS NULL OR participation_quota > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cbt_teachers_quota_reset_check'
  ) THEN
    ALTER TABLE cbt.teachers
      ADD CONSTRAINT cbt_teachers_quota_reset_check
      CHECK (
        quota_reset_mode IN ('none', 'monthly', 'days')
        AND (quota_reset_mode = 'none' OR quota_period_anchor IS NOT NULL)
        AND (quota_reset_mode <> 'days' OR (quota_period_days IS NOT NULL AND quota_period_days > 0))
      ) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cbt.participation_ledger (
  participant_id TEXT PRIMARY KEY,
  teacher_id     TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
  room_id        TEXT NOT NULL,
  room_name      TEXT,
  display_name   TEXT,
  student_code   TEXT,
  counted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbt_participation_ledger_teacher
  ON cbt.participation_ledger (teacher_id, counted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_participation_ledger_room
  ON cbt.participation_ledger (room_id);

CREATE TABLE IF NOT EXISTS cbt.participation_requests (
  id                   TEXT PRIMARY KEY,
  teacher_id           TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
  requested_by         TEXT,
  requested_additional INTEGER NOT NULL CHECK (requested_additional > 0),
  note                 TEXT,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  used_at_request      INTEGER NOT NULL DEFAULT 0,
  quota_at_request     INTEGER,
  granted_quota        INTEGER,
  admin_note           TEXT,
  decided_by           TEXT,
  decided_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one open request per teacher (mirrors uq_teacher_code_request_pending).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbt_participation_request_pending
  ON cbt.participation_requests (teacher_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cbt_participation_requests_status
  ON cbt.participation_requests (status, created_at DESC);

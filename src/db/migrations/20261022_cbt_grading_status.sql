-- CBT grading status — 2026-10-22
-- Spec: V1/docs/bug-fixes/04-contest-cbt.md, C6.
--
-- WHY
--   submitAttempt claims an attempt (sets finished_at) in one transaction and
--   grades it afterwards, outside any transaction (grading calls the grader
--   service over the network, so it must not hold row locks). When grading
--   failed after the claim, the row was left with finished_at set and score
--   NULL forever: every sweep filters on finished_at IS NULL, so nothing ever
--   retried it, and the teacher saw a blank like an absent student.
--
-- WHAT THIS ADDS
--   • room_participants.grading_status   — 'pending' (claimed, grading still
--     owed), 'done', or 'failed' (gave up after 5 tries; the teacher can retry).
--     DEFAULT 'done', so legacy rows and 'absent' rows are never re-swept.
--   • room_participants.grading_attempts — failed grading tries so far.
--   • room_participants.grading_error    — last failure message (≤ 500 chars).
--   • room_participants.grading_next_attempt_at — when the regrade sweep may
--     try this row again: exponential backoff after each failure (30 s, 2 m,
--     8 m, 30 m) and a short lease while one instance is grading it, so a
--     database blip cannot burn the 5 tries in a minute. NULL = due now.
--   • a partial index for the regrade sweep (only 'pending' rows, so it is tiny).
--   • a one-off repair: rows already stranded by this bug go back to 'pending'
--     and the next CBT sweep grades them.
--
-- APPLY BY HAND on Neon BEFORE deploying the code (not in the build-time
-- allowlist). ensureCbtSchema() mirrors every statement for dev/preview.
-- The CHECK is added NOT VALID (catalog-only); the column default satisfies it.
--
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE cbt.room_participants
  ADD COLUMN IF NOT EXISTS grading_status   TEXT    NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS grading_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grading_error    TEXT,
  ADD COLUMN IF NOT EXISTS grading_next_attempt_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cbt_participants_grading_status_check'
  ) THEN
    ALTER TABLE cbt.room_participants
      ADD CONSTRAINT cbt_participants_grading_status_check
      CHECK (grading_status IN ('pending', 'done', 'failed')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cbt_participants_grading_pending
  ON cbt.room_participants (finished_at) WHERE grading_status = 'pending';

-- One-off repair of rows already stranded by this bug. Only rows with a graded
-- finalize_reason: 'absent' is ungraded by design, and a NULL reason is a
-- pre-20260802 row whose blank score may be a genuine no-show.
UPDATE cbt.room_participants
   SET grading_status = 'pending'
 WHERE grading_status = 'done'
   AND finished_at IS NOT NULL
   AND score IS NULL
   AND finalize_reason IS NOT NULL
   AND finalize_reason <> 'absent';

INSERT INTO app.migrations (id, name)
VALUES ('20261022_cbt_grading_status', 'cbt grading status + regrade sweep')
ON CONFLICT (id) DO NOTHING;

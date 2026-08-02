-- CBT attempt resilience — 2026-08-02
-- Plan: V1/allmd/CBT_ATTEMPT_RESILIENCE_AND_TEST_COMPOSITION_PLAN_2026-08-02.md
--
-- WHAT THIS ADDS
--   • room_participants.finalize_reason  — WHY an attempt ended (drives the
--     Excel "Remark" column; 'expired_offline' is the "went offline and never
--     came back" case that used to be reported as "absent" with no score).
--   • room_participants.rejoin_count / last_rejoin_at — identity-recovery audit.
--   • room_participants.violation_count — integrity strikes at submit time
--     (the client already sent `malpractice`; the server used to drop it).
--   • answer_drafts.rev — monotonic client revision so a stale tab or a late
--     sendBeacon can never overwrite newer answers saved from another device.
--   • rooms.rejoin_policy — per-room switch between "name or student id" and
--     strict "student id only" recovery.
--
-- LOCK / LOAD BUDGET — this file must stay O(1) on Neon.
--   This runs inside the Vercel `prebuild` step (scripts/run-migrations.mjs) as
--   ONE implicit transaction, while production traffic is live. So it contains
--   ONLY catalog-level operations:
--     · ADD COLUMN with a *constant* DEFAULT → metadata-only on PG 11+, no
--       table rewrite, no per-row work.
--     · ADD CONSTRAINT ... NOT VALID → instant. New and updated rows are
--       checked immediately; the existing-row scan is deferred.
--   Deliberately NOT here:
--     · the historical backfill of finalize_reason (an unbounded UPDATE would
--       hold a long write transaction over the whole table);
--     · CREATE INDEX (takes a write lock) — the two new partial indexes are
--       built CONCURRENTLY afterwards.
--   Both are done online, in chunks, by scripts/backfill-cbt-attempt-resilience.mjs
--   and by advanceCbtResilienceBackfill() which the CBT drain cron ticks until
--   it converges. Readers tolerate a NULL finalize_reason throughout (they fall
--   back to the legacy auto_submitted flag), so the deploy is safe mid-backfill.
--
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE cbt.room_participants
  ADD COLUMN IF NOT EXISTS finalize_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejoin_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rejoin_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE cbt.answer_drafts
  ADD COLUMN IF NOT EXISTS rev BIGINT NOT NULL DEFAULT 0;

ALTER TABLE cbt.rooms
  ADD COLUMN IF NOT EXISTS rejoin_policy TEXT NOT NULL DEFAULT 'name_or_id';

-- NOT VALID: enforced for every new/updated row from now on, without scanning
-- the existing table. VALIDATE CONSTRAINT runs later, online, under a lock that
-- does not block reads or writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cbt_participants_finalize_reason_check'
  ) THEN
    ALTER TABLE cbt.room_participants
      ADD CONSTRAINT cbt_participants_finalize_reason_check
      CHECK (finalize_reason IS NULL OR finalize_reason IN (
        'manual', 'timer', 'malpractice', 'expired_offline',
        'room_closed', 'forced_by_teacher', 'absent')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cbt_rooms_rejoin_policy_check'
  ) THEN
    ALTER TABLE cbt.rooms
      ADD CONSTRAINT cbt_rooms_rejoin_policy_check
      CHECK (rejoin_policy IN ('name_or_id', 'id_only')) NOT VALID;
  END IF;
END $$;

-- Rollback for 20260802_cbt_attempt_resilience.sql
-- Drops only what that migration (and its online backfill companion) added.
-- Attempt history — scores, submissions, drafts — is untouched; the dropped
-- columns are metadata about how an attempt ended.
--
-- Run in psql (autocommit), NOT inside a transaction: DROP INDEX CONCURRENTLY
-- cannot run in a transaction block. The migration runner never executes
-- rollback files, so this is a manual-only script.

DROP INDEX CONCURRENTLY IF EXISTS cbt.idx_cbt_rooms_live_deadline;
DROP INDEX CONCURRENTLY IF EXISTS cbt.idx_cbt_participants_room_unfinished;

ALTER TABLE cbt.rooms DROP CONSTRAINT IF EXISTS cbt_rooms_rejoin_policy_check;
ALTER TABLE cbt.rooms DROP COLUMN IF EXISTS rejoin_policy;

ALTER TABLE cbt.answer_drafts DROP COLUMN IF EXISTS rev;

ALTER TABLE cbt.room_participants DROP CONSTRAINT IF EXISTS cbt_participants_finalize_reason_check;
ALTER TABLE cbt.room_participants
  DROP COLUMN IF EXISTS violation_count,
  DROP COLUMN IF EXISTS last_rejoin_at,
  DROP COLUMN IF EXISTS rejoin_count,
  DROP COLUMN IF EXISTS finalize_reason;

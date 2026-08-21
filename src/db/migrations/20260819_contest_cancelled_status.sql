-- Add 'cancelled' to the contest.contests status CHECK (USER database).
-- Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0 (cancel/reschedule flow).
--
-- 'cancelled' is a terminal state distinct from 'archived': archived = the
-- contest ran and finished; cancelled = it was called off before running.
-- Registration records are retained (the contest simply never runs).
--
-- Idempotent: drop-if-exists then re-add. Mirrored by the runtime-ensure CHECK
-- in src/server/contest/contest-schema.ts.

ALTER TABLE contest.contests DROP CONSTRAINT IF EXISTS contests_status_check;

ALTER TABLE contest.contests
  ADD CONSTRAINT contests_status_check
  CHECK (status IN ('draft','scheduled','result_processing','result_published','archived','cancelled'));

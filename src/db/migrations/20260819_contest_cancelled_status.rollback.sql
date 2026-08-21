-- Rollback: revert the contest.contests status CHECK to exclude 'cancelled'.
-- Only safe if no row currently holds status='cancelled' (the re-added CHECK
-- would reject them). Cancel any such contests first, or archive them.

ALTER TABLE contest.contests DROP CONSTRAINT IF EXISTS contests_status_check;

ALTER TABLE contest.contests
  ADD CONSTRAINT contests_status_check
  CHECK (status IN ('draft','scheduled','result_processing','result_published','archived'));

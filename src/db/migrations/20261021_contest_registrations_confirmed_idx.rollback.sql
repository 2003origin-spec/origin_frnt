-- Rollback: Contest confirmed-registration partial index (bug-fix C5).
DROP INDEX IF EXISTS contest.idx_registrations_confirmed;

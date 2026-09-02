-- Rollback: Contest access & eligibility.
DROP TABLE IF EXISTS contest.access_codes;
DROP INDEX IF EXISTS contest.idx_registrations_waitlist;
ALTER TABLE contest.registrations DROP COLUMN IF EXISTS status;
ALTER TABLE contest.contests DROP COLUMN IF EXISTS registration_cap;
ALTER TABLE contest.contests DROP COLUMN IF EXISTS access_mode;

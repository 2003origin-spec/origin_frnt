-- Contest confirmed-registration partial index (bug-fix C5). Additive +
-- idempotent. USER database. Mirrored by ensureContestSchema()
-- (src/server/contest/contest-schema.ts).
--
-- The attempt-start JOIN, the paper gate (isRegisteredForContest), the reminder
-- sweep and the analytics funnel now all filter on status = 'registered', so a
-- waitlisted row can never start a rated attempt or read the paper.

CREATE INDEX IF NOT EXISTS idx_registrations_confirmed
  ON contest.registrations(contest_id, user_id) WHERE status = 'registered';

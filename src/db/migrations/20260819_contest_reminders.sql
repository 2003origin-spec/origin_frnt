-- Contest reminder idempotency ledger (USER database).
-- Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 2b.
--
-- One row per (contest, user, reminder-kind) that has been sent, so a cron
-- re-fire never double-notifies. Additive + idempotent. Mirrored by the
-- runtime-ensure in src/server/contest/contest-schema.ts.

CREATE TABLE IF NOT EXISTS contest.reminders_sent (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL
                  CHECK (reminder_kind IN ('confirmation','t_24h','t_1h','t_10m','results')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id, reminder_kind)
);

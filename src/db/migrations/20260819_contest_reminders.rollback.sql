-- Rollback for 20260819_contest_reminders.sql (USER database).
-- Drops the reminder idempotency ledger; only re-run when removing Phase 2b.

DROP TABLE IF EXISTS contest.reminders_sent;

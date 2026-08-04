-- Rollback for 20260804_cbt_report_cards.sql
-- Drops only what that migration added. Attempt history — scores, submissions,
-- drafts, ranks — is untouched: the dropped columns are the per-subject
-- breakdown (re-derivable from cbt.submission_answers), the advisory
-- per-question timing, and the two report-card feature switches.
--
-- Dropping report_cards_enabled / report_share_enabled also disables every
-- published report link, which is the intended effect of a rollback.
--
-- The migration runner never executes rollback files; this is manual-only.

ALTER TABLE cbt.submission_answers DROP COLUMN IF EXISTS time_spent_seconds;

ALTER TABLE cbt.answer_drafts DROP COLUMN IF EXISTS times;

ALTER TABLE cbt.room_participants DROP COLUMN IF EXISTS section_scores;

ALTER TABLE cbt.rooms DROP COLUMN IF EXISTS report_share_enabled;

ALTER TABLE cbt.teachers DROP COLUMN IF EXISTS report_cards_enabled;

-- Rollback for 20260812_full_length_mock_tests.sql (OGCODE database).
--
-- Dropping these columns discards the blueprint and the per-question marking of
-- every full-length mock ever generated: those tests would still be takeable but
-- would grade on the platform default (+4/-1 everywhere) instead of the exam's
-- own scheme. Only run this if the feature is being removed outright.

DROP INDEX IF EXISTS analytics.idx_analytics_custom_tests_user_preset;

ALTER TABLE analytics.custom_test_questions DROP COLUMN IF EXISTS negative_marks;
ALTER TABLE analytics.custom_test_questions DROP COLUMN IF EXISTS marks;
ALTER TABLE analytics.custom_test_questions DROP COLUMN IF EXISTS section_id;

ALTER TABLE analytics.custom_tests DROP COLUMN IF EXISTS blueprint;
ALTER TABLE analytics.custom_tests DROP COLUMN IF EXISTS exam_preset;

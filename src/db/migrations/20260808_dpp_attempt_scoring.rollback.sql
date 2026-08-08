-- Rollback for 20260808_dpp_attempt_scoring.sql
--
-- Drops the practice-scoring columns and the batch stamp. No rows are deleted:
-- every DPP plan, attempt and progress_score survives, so students keep their
-- solved history and the student-facing DPP surface is unaffected. Only the
-- teacher-side practice leaderboard loses its data source.

DROP INDEX IF EXISTS analytics.idx_analytics_dpp_attempts_plan_created;
DROP INDEX IF EXISTS analytics.idx_analytics_dpp_plans_batch;

ALTER TABLE analytics.dpp_attempts DROP COLUMN IF EXISTS percentage;
ALTER TABLE analytics.dpp_attempts DROP COLUMN IF EXISTS total_marks;
ALTER TABLE analytics.dpp_attempts DROP COLUMN IF EXISTS score;

ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS batch_id;

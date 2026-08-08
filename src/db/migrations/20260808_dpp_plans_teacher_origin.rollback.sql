-- Rollback for 20260808_dpp_plans_teacher_origin.sql
--
-- Deletes every materialized teacher DPP first (they are meaningless without
-- the origin column), then drops the columns. Auto-generated DPPs and all of
-- their attempts are untouched.
--
-- NOTE: this also drops the attempts students made on teacher DPPs
-- (analytics.dpp_attempts cascades from analytics.dpp_plans). Only run it if
-- the feature is being removed outright — flipping
-- TEACHER_LAUNCH_TEACHER_DPP_SHARE=0 takes the surface dark with no data loss
-- and is the normal rollback.

DELETE FROM analytics.dpp_plans WHERE origin = 'teacher';

DROP INDEX IF EXISTS analytics.idx_analytics_dpp_plans_teacher_share;
DROP INDEX IF EXISTS analytics.idx_analytics_dpp_plans_origin;

ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS expires_at;
ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS teacher_logo_url;
ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS teacher_display_name;
ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS teacher_share_id;
ALTER TABLE analytics.dpp_plans DROP COLUMN IF EXISTS origin;

-- Rollback for 20260808_teacher_dpp_shares.sql
--
-- Drops the teacher DPP share tables. Student-side materialized plans live in
-- analytics.dpp_plans (other pool) and are removed by the companion rollback
-- 20260808_dpp_plans_teacher_origin.rollback.sql. Auto-generated DPPs are not
-- touched by either.

DROP TABLE IF EXISTS assessment.teacher_dpp_share_batches;
DROP TABLE IF EXISTS assessment.teacher_dpp_shares;

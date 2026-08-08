-- Rollback for 20260808_dpp_question_results.sql
--
-- Drops the per-question DPP results. Teacher practice scoring reverts to the
-- submit-only behaviour, which in practice records nothing (a DPP has no submit
-- button) — so only roll this back if the whole practice-scoring feature is
-- being removed. DPP plans, attempts and student-facing progress are untouched.

DROP TABLE IF EXISTS analytics.dpp_question_results;

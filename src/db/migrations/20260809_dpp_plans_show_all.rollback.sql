-- Rollback: drop DPP-plan presentation-mode column — 2026-08-09
ALTER TABLE analytics.dpp_plans
  DROP COLUMN IF EXISTS show_all_questions;

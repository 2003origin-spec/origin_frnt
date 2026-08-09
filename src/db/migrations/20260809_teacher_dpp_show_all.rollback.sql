-- Rollback: drop teacher DPP presentation-mode column — 2026-08-09
ALTER TABLE assessment.teacher_dpp_shares
  DROP COLUMN IF EXISTS show_all_questions;

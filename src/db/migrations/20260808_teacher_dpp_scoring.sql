-- Teacher DPP marks snapshot — 2026-08-08
-- Plan: V1/allmd/TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md (Phase A)
--
-- WHAT THIS ADDS
--   • assessment.teacher_dpp_shares.question_marks — a JSONB array PARALLEL to
--     question_ids, holding the per-question marks the teacher assigned in the
--     source test: [{"m": 4, "n": -1}, {"m": 2, "n": 0}, …]. A correct answer in
--     the shared DPP is then worth exactly what it was worth in the test.
--
-- Deliberately a NEW parallel column rather than a change to question_ids'
-- shape: shares created before this migration are already live in production
-- and must keep working. NULL here means "no snapshot" and the DPP falls back
-- to the default practice policy, so nothing already shared re-scores.
--
-- Snapshotted for the same reason the question ids are: re-weighting the test
-- later must not silently re-score a DPP a student already sat.
--
-- Metadata-only ADD COLUMN (nullable, no default) — no table rewrite on PG 11+.
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE assessment.teacher_dpp_shares
  ADD COLUMN IF NOT EXISTS question_marks JSONB;

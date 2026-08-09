-- DPP presentation mode (Institute = all at once) — 2026-08-09
-- Plan: V1/DPP_PRESENTATION_MODE_PLAN.md (Phase 1)
--
-- TRUE = student sees every question at once (worksheet / "Institute mode").
-- FALSE (default) = one question at a time (existing behavior).
-- Metadata-only ADD COLUMN with a constant default — no table rewrite on PG 11+.
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE assessment.teacher_dpp_shares
  ADD COLUMN IF NOT EXISTS show_all_questions BOOLEAN NOT NULL DEFAULT FALSE;

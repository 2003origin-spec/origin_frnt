-- Study Mode (JEE / NEET / PCMB) — per-student single-select that scopes every
-- subject-tagged surface to the subjects of the chosen mode.
-- USER pool (origin_users). Mirrored by the runtime-ensure in db-users.ts.
-- Idempotent + additive; safe to re-run.
--
-- study_mode IS NULL means "never chosen" and resolves to DEFAULT_STUDY_MODE
-- ('pcmb' = everything visible = pre-feature behaviour). There is deliberately
-- NO backfill from selected_course: inferring jee/neet for a live student would
-- make a whole subject disappear without them acting. Adoption runs through the
-- dismissible first-run prompt, whose "asked already" marker is
-- study_mode_prompted_at.
--
-- See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.

ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS study_mode TEXT;
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS study_mode_prompted_at TIMESTAMPTZ;

-- Drop-then-add so re-running after a value change replaces the constraint
-- rather than failing on a duplicate name.
ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_study_mode_check;
ALTER TABLE origin_users ADD CONSTRAINT origin_users_study_mode_check
  CHECK (study_mode IS NULL OR study_mode IN ('jee', 'neet', 'pcmb'));

-- Manual question diagram image for the teacher Question Bag — 2026-08-05
-- Plan: V1/TEACHER_AUTHORING_FIXES_PLAN.md (Phase 0)
--
-- WHAT THIS ADDS
--   • content.question_versions.image_url — the manual question diagram image
--     uploaded in the teacher question editor (and, going forward, carried from
--     document-import review). Until now this column only existed as a
--     runtime-ensure ALTER (src/server/workspaces/content-schema.ts); production
--     never had a migration file, so the column's existence depended on the
--     ensure having run. This makes it a first-class, prod-applied migration.
--
-- Metadata-only ADD COLUMN (nullable, no default) — no table rewrite on PG 11+.
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE content.question_versions
  ADD COLUMN IF NOT EXISTS image_url TEXT;

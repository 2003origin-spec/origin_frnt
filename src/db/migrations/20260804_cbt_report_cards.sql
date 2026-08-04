-- CBT sectional marking + shareable report cards — 2026-08-04
-- Plan: V1/allmd/CBT_REPORT_CARDS_AND_TEACHER_MULTI_SOURCE_PLAN_2026-08-04.md
--
-- WHAT THIS ADDS
--   • teachers.report_cards_enabled     — the ADMIN switch for the premium
--     report-card feature, per CBT teacher. Default FALSE: the feature is dark
--     for every existing teacher until an admin turns it on.
--   • rooms.report_share_enabled        — the TEACHER switch, per room. A
--     published room is the only thing a shareable report link can resolve to.
--   • room_participants.section_scores  — per-subject {score, max, correct,
--     wrong, skipped, needsReview, count, timeSeconds} written at grading time.
--     Legacy rows stay '{}' and are derived on read from submission_answers,
--     so NO backfill is needed and none is done here (see below).
--   • answer_drafts.times               — {position: seconds} the player
--     accumulates while the student is on each question. Advisory only; it
--     never influences a mark or a rank.
--   • submission_answers.time_spent_seconds — that timing snapshotted at
--     grading, next to the question snapshot it belongs to.
--
-- LOCK / LOAD BUDGET — this file must stay O(1) on Neon.
--   It runs inside the Vercel `prebuild` step (scripts/run-migrations.mjs) as
--   ONE implicit transaction while production traffic is live, so it contains
--   ONLY catalog-level operations: ADD COLUMN with a *constant* DEFAULT, which
--   is metadata-only on PG 11+ (no table rewrite, no per-row work).
--
--   Deliberately NOT here:
--     · a section_scores backfill. An unbounded UPDATE would hold a long write
--       transaction over the whole table. Instead, every read path derives
--       sections from cbt.submission_answers when section_scores is '{}', so
--       pre-migration attempts are correct with zero migration cost.
--     · CREATE INDEX. The report-card unlock looks up
--       (room_id, student_code), which the existing
--       UNIQUE (room_id, student_code) constraint index already serves.
--
-- Purely additive and idempotent; safe to re-run.

ALTER TABLE cbt.teachers
  ADD COLUMN IF NOT EXISTS report_cards_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cbt.rooms
  ADD COLUMN IF NOT EXISTS report_share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE cbt.room_participants
  ADD COLUMN IF NOT EXISTS section_scores JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE cbt.answer_drafts
  ADD COLUMN IF NOT EXISTS times JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE cbt.submission_answers
  ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0;

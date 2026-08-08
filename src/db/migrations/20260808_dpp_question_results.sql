-- Per-question DPP results — 2026-08-08
-- Plan: V1/allmd/TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md (Phase E)
--
-- WHY THIS EXISTS
--   A DPP has no submit button. The student works question by question and
--   presses "Check Answer", which grades one question and reveals the solution;
--   there is no moment at which the whole set is handed in. Scoring was hung off
--   submitGeneratedDpp, so a student who answered 43 of 50 questions and then
--   navigated away recorded NOTHING — the teacher's board showed "0 DPPs, 0
--   points" for real work that had actually been done.
--
--   This table makes each checked answer durable the instant it is graded, so
--   progress survives closing the DPP, switching to another part of the app, or
--   losing the tab. There is no session-end flush to miss and no unload beacon
--   to drop: by the time the student navigates away, everything is already
--   written.
--
-- SEMANTICS
--   • One row per (dpp, question) — dpp_id already encodes the student, since a
--     plan is materialized per student (tdpp_<share>_<user>).
--   • ON CONFLICT DO NOTHING at the write site keeps the FIRST graded attempt.
--     A student cannot re-answer a revealed question to farm marks.
--   • Questions never attempted have NO row: they contribute 0 to the score and
--     0 to the marks-available denominator, which is what "unattempted counts as
--     zero" means without punishing partial completion as if it were a bad
--     paper. Coverage is reported separately (attempted vs total).
--
-- Lives in the analytics/OGCODE database, cascading from analytics.dpp_plans so
-- an expiring teacher DPP cleans up its own rows. Idempotent; safe to re-run.
-- Mirrored by the runtime-ensure DDL in src/legacy/analytics-store.ts.

CREATE TABLE IF NOT EXISTS analytics.dpp_question_results (
  dpp_id             TEXT NOT NULL REFERENCES analytics.dpp_plans(id) ON DELETE CASCADE,
  question_id        TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  is_correct         BOOLEAN NOT NULL,
  marks_awarded      DOUBLE PRECISION NOT NULL,
  max_marks          DOUBLE PRECISION NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  answered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (dpp_id, question_id)
);

-- Drives the per-student practice aggregates on the teacher's leaderboard.
CREATE INDEX IF NOT EXISTS idx_dpp_question_results_user
  ON analytics.dpp_question_results (user_id, answered_at DESC);

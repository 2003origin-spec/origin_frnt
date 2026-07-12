-- OGCode per-option answer distribution (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §9 add-on).
-- Records how many students picked each CANONICAL option index per question so
-- the result view can show "N% of people chose this" beside every option. On the
-- OGCODE pool, co-located with ogcode_questions. Public aggregate — no per-user
-- rows. Mirrored by the runtime-ensure src/server/ogcode-option-stats.ts.
--
-- Idempotent: safe to re-run. Purely additive.

CREATE TABLE IF NOT EXISTS ogcode_question_option_choices (
  question_id  TEXT NOT NULL,
  option_index SMALLINT NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (question_id, option_index)
);

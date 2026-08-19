-- Question of the Day — four daily subject draws replacing the global per-mode pick.
-- Target database: OGCODE (sits beside ogcode_questions).
-- Plan: V1/allmd/QUESTION_OF_THE_DAY_PER_STUDENT_PLAN_2026-08-19.md §3.6
--
-- Idempotent. Mirrored by the runtime-ensure block in
-- src/server/ogcode-daily-question.ts, so an un-migrated database self-heals on
-- first use.
--
-- Exactly one row per (IST day, class band, subject) — four rows a day today,
-- eight once class 9-10 content lands. `cycle` is the bag's recycle counter:
-- when a bag has served every question it holds, the counter increments and a
-- fresh random pass begins, so a bag's history is never deleted and "which pass
-- is this bag on" stays answerable.
--
-- No user_id column, deliberately: which of the four draws a student sees is a
-- pure function of their accessible subjects and the day number, so cohorts are
-- derived on every request and never stored.

CREATE TABLE IF NOT EXISTS ogcode_daily_subject_questions (
  -- IST calendar day (the product is India-only; see src/lib/ist-day.ts).
  pick_date   DATE    NOT NULL,
  -- 'senior' (classes 11-12) | 'junior' (classes 9-10). See src/lib/qotd-eligibility.ts.
  class_band  TEXT    NOT NULL,
  -- Canonical subject: physics | chemistry | mathematics | biology.
  subject     TEXT    NOT NULL,
  question_id TEXT    NOT NULL,
  cycle       INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One draw per bag per day. The midnight cron and a lazy first read racing on
  -- the same bag converge through ON CONFLICT DO NOTHING + a read-back.
  PRIMARY KEY (pick_date, class_band, subject)
);

-- The served-set read: "every question this bag has handed out in this cycle".
CREATE INDEX IF NOT EXISTS ogcode_daily_subject_questions_bag_idx
  ON ogcode_daily_subject_questions (class_band, subject, cycle);

-- The old global per-mode pick. Its only reader (getOgcodeChallengeQuestion) is
-- deleted in the same commit; every student now resolves through the per-subject
-- bags above, so leaving the table would leave a table nothing can write or read.
DROP TABLE IF EXISTS ogcode_daily_challenges;

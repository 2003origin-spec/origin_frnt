-- Canonical sign for teacher negative marks — 2026-08-10
-- Plan: V1/allmd/TEACHER_DPP_DELIVERY_AND_LIVE_SCORING_PLAN.md (D2, §3)
--
-- WHAT WAS WRONG
--   The test-authoring wizard's "Negative Marks (−)" field is a MAGNITUDE
--   (min=0, default 1) and the edit page converts storage back with Math.abs(),
--   but nothing on the write path ever negated it. CreateTestDialog, the source
--   stack and the document importer all send -1. So
--   assessment.test_questions.negative_marks holds BOTH signs — verified in
--   production on 2026-08-10: 96 rows at +1, 36 rows at -1.
--
--   A positive value then reached policyFromQuestionMarks as
--   `incorrectMarks: 1, negativeMarkingMode: "none"`, and computeMarksFromCredit
--   returned Math.max(0, 1) = +1 — i.e. a shared DPP AWARDED a mark for every
--   wrong answer. A student who got all 7 questions wrong scored 7/28 (25%)
--   instead of -7/28.
--
-- WHAT THIS DOES
--   Rewrites both stores to the one canonical rule: negative marks are always
--   ≤ 0. 0 is left untouched — "no negative marking" is a real teacher choice
--   and their number wins (TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md D2).
--
--   1. assessment.test_questions.negative_marks       → -ABS(...)
--   2. assessment.teacher_dpp_shares.question_marks[].n → -ABS(...)
--
--   (2) is the already-snapshotted copy carried by live shares. The application
--   ALSO canonicalises on read (canonicalNegativeMarks in policyFromQuestionMarks),
--   so this migration is a tidy-up rather than the fix: correct scoring resumes
--   the moment the code deploys, with or without it.
--
-- Idempotent — re-running matches nothing. Safe to re-run.

UPDATE assessment.test_questions
   SET negative_marks = -ABS(negative_marks)
 WHERE negative_marks > 0;

-- WITH ORDINALITY keeps element order, which is load-bearing: question_marks[i]
-- must stay parallel to question_ids[i] (that pairing is what the scoring
-- override is built from).
UPDATE assessment.teacher_dpp_shares s
   SET question_marks = sub.rebuilt
  FROM (
    SELECT t.id,
           jsonb_agg(
             CASE
               WHEN (e->>'n') ~ '^-?[0-9]+(\.[0-9]+)?$' AND (e->>'n')::numeric > 0
                 THEN jsonb_set(e, '{n}', to_jsonb(-ABS((e->>'n')::numeric)))
               ELSE e
             END
             ORDER BY ord
           ) AS rebuilt
      FROM assessment.teacher_dpp_shares t,
           LATERAL jsonb_array_elements(t.question_marks) WITH ORDINALITY AS a(e, ord)
     WHERE t.question_marks IS NOT NULL
       AND jsonb_typeof(t.question_marks) = 'array'
     GROUP BY t.id
  ) AS sub
 WHERE s.id = sub.id
   AND s.question_marks IS DISTINCT FROM sub.rebuilt;

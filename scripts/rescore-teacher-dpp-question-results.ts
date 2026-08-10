/**
 * One-off repair: teacher-DPP answers recorded under the inverted negative-marks sign.
 *
 * Plan: V1/allmd/TEACHER_DPP_DELIVERY_AND_LIVE_SCORING_PLAN.md (§3.1)
 *
 * WHY THIS EXISTS
 *   `assessment.test_questions.negative_marks` held a positive magnitude for every
 *   test authored in the wizard, which reached `policyFromQuestionMarks` as
 *   "no negative marking, worth +1" and made `computeMarksFromCredit` return
 *   `Math.max(0, +1)`. A shared DPP therefore AWARDED a mark for every wrong
 *   answer: a student who got all 7 questions wrong was recorded at 7/28 (25%).
 *
 *   The code fix is forward-only — `analytics.dpp_question_results` rows written
 *   before the deploy keep their wrong value, and the student keeps seeing it.
 *   This script rewrites them.
 *
 * WHAT IT REWRITES — deliberately narrow
 *   Only rows where `is_correct = FALSE` AND `marks_awarded = ABS(n)` for that
 *   question's snapshot, i.e. rows carrying the bug's exact fingerprint. They
 *   become `-ABS(n)`. Anything else is reported and left alone:
 *     · correct answers were always right;
 *     · a wrong answer at 0 is a teacher who chose no negative marking;
 *     · a fractional value is MSQ/matrix partial credit, and the credit fraction
 *       is not stored, so it cannot be recomputed honestly.
 *
 *   Shares expire after 30 days and are then swept, taking the snapshot with
 *   them while the student's recorded answers survive. For those orphaned rows
 *   the penalty is recovered from the row itself, but ONLY for question types
 *   that cannot earn partial credit (MCQ, numerical): the grader awards exactly
 *   `credit = 0` on a wrong answer there, so a positive `marks_awarded` can only
 *   have come from `Math.max(0, +n)` and its magnitude IS `n`. That is a
 *   deduction, not a guess. An MSQ or matrix row is left alone.
 *
 *   `analytics.dpp_attempts.score`/`percentage` for the same plans are then
 *   recomputed from the corrected rows (`total_marks` is untouched — the sign bug
 *   never affected marks-available).
 *
 * USAGE
 *   Dry run (default — prints every change, writes nothing):
 *     npx tsx --env-file=/path/to/.env scripts/rescore-teacher-dpp-question-results.ts
 *   Apply, in a single transaction per pool:
 *     npx tsx --env-file=/path/to/.env scripts/rescore-teacher-dpp-question-results.ts --apply
 */

import { Pool } from "pg";

import { canonicalNegativeMarks } from "@/lib/assessments/source-stack";
import { safePercentage } from "@/server/teacher-dpp-scoring";

const APPLY = process.argv.includes("--apply");

type QuestionMarks = { m: number; n: number };

type ResultRow = {
  dppId: string;
  questionId: string;
  userId: string;
  isCorrect: boolean;
  marksAwarded: number;
  maxMarks: number;
};

type Rewrite = ResultRow & { corrected: number };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

async function main() {
  const userPool = new Pool({ connectionString: requireEnv("USER_DATABASE_URL"), max: 2 });
  const ogPool = new Pool({ connectionString: requireEnv("OGCODE_DATABASE_URL"), max: 2 });

  try {
    // 1. Teacher-origin plans and the share each one materialised from. The two
    //    schemas are separate logical databases, so this is stitched in
    //    application code — never a SQL join (TEACHER_TEST_AS_DPP_PLAN §2.1).
    const plans = await ogPool.query<{ id: string; teacher_share_id: string | null }>(
      `SELECT id, teacher_share_id
         FROM analytics.dpp_plans
        WHERE origin = 'teacher' AND teacher_share_id IS NOT NULL`,
    );
    if (plans.rows.length === 0) {
      console.log("No teacher-origin DPP plans. Nothing to do.");
      return;
    }

    const shareIds = [...new Set(plans.rows.map((p) => p.teacher_share_id as string))];
    const shares = await userPool.query<{
      id: string;
      question_ids: string[] | null;
      question_marks: QuestionMarks[] | null;
    }>(
      `SELECT id, question_ids, question_marks
         FROM assessment.teacher_dpp_shares
        WHERE id = ANY($1::text[])`,
      [shareIds],
    );

    // questionId → marks, per share. Parallel arrays by construction.
    const marksByShare = new Map<string, Map<string, QuestionMarks>>();
    for (const share of shares.rows) {
      if (!share.question_marks || !share.question_ids) continue;
      const map = new Map<string, QuestionMarks>();
      share.question_ids.forEach((questionId, index) => {
        const marks = share.question_marks?.[index];
        if (marks) map.set(questionId, marks);
      });
      marksByShare.set(share.id, map);
    }

    const shareByPlan = new Map(plans.rows.map((p) => [p.id, p.teacher_share_id as string]));

    // 2. Every recorded answer on those plans.
    const results = await ogPool.query<{
      dpp_id: string;
      question_id: string;
      user_id: string;
      is_correct: boolean;
      marks_awarded: string;
      max_marks: string;
    }>(
      `SELECT dpp_id, question_id, user_id, is_correct, marks_awarded, max_marks
         FROM analytics.dpp_question_results
        WHERE dpp_id = ANY($1::text[])`,
      [plans.rows.map((p) => p.id)],
    );

    // Question types, for the orphaned rows whose share has been swept. Both
    // banks are consulted because a test can mix them; a type we cannot resolve
    // stays unresolved and its row is left alone.
    const questionTypes = new Map<string, string>();
    const allQuestionIds = [...new Set(results.rows.map((r) => r.question_id))];
    if (allQuestionIds.length > 0) {
      const bagTypes = await userPool.query<{ id: string; question_type: string }>(
        `SELECT q.id, v.question_type
           FROM content.questions q
           JOIN content.question_versions v ON v.id = q.current_version_id
          WHERE q.id = ANY($1::text[])`,
        [allQuestionIds],
      );
      for (const row of bagTypes.rows) questionTypes.set(row.id, row.question_type);

      const ogTypes = await ogPool.query<{ id: string; question_type: string }>(
        `SELECT id, question_type FROM ogcode_questions WHERE id = ANY($1::text[])`,
        [allQuestionIds],
      );
      for (const row of ogTypes.rows) questionTypes.set(row.id, row.question_type);
    }

    /** Types where a wrong answer earns credit 0, so no partial credit is possible. */
    const NO_PARTIAL_CREDIT = new Set(["mcq", "numerical", "numerical_with_units", "range"]);

    const rewrites: Rewrite[] = [];
    const skipped: { row: ResultRow; reason: string }[] = [];

    for (const raw of results.rows) {
      const row: ResultRow = {
        dppId: raw.dpp_id,
        questionId: raw.question_id,
        userId: raw.user_id,
        isCorrect: raw.is_correct,
        marksAwarded: Number(raw.marks_awarded),
        maxMarks: Number(raw.max_marks),
      };

      if (row.isCorrect) continue; // correct answers were never affected
      if (row.marksAwarded <= 0) continue; // already a deduction, or a deliberate 0

      const shareId = shareByPlan.get(row.dppId);
      const marks = shareId ? marksByShare.get(shareId)?.get(row.questionId) : undefined;
      if (!marks) {
        // Share swept after its 30 days. Recoverable only where partial credit
        // cannot exist, because there the recorded value IS the teacher's
        // magnitude and nothing else could have produced it.
        const questionType = questionTypes.get(row.questionId);
        if (!questionType) {
          skipped.push({ row, reason: "share swept and question type unknown" });
          continue;
        }
        if (!NO_PARTIAL_CREDIT.has(questionType)) {
          skipped.push({
            row,
            reason: `share swept and ${questionType} can earn partial credit — not inferable`,
          });
          continue;
        }
        rewrites.push({ ...row, corrected: -row.marksAwarded });
        continue;
      }

      const penalty = canonicalNegativeMarks(marks.n);
      if (penalty === 0) {
        skipped.push({ row, reason: "teacher set no negative marking (n = 0)" });
        continue;
      }
      if (row.marksAwarded !== Math.abs(penalty)) {
        // Not the bug's fingerprint — most likely partial credit, whose fraction
        // is not stored. Rewriting it would be a guess.
        skipped.push({ row, reason: `unrecognised value (expected ${Math.abs(penalty)})` });
        continue;
      }

      rewrites.push({ ...row, corrected: penalty });
    }

    console.log(`\nScanned ${results.rows.length} recorded answers across ${plans.rows.length} teacher DPP plans.`);
    console.log(`  to rewrite: ${rewrites.length}`);
    console.log(`  left alone: ${skipped.length}`);

    if (rewrites.length > 0) {
      console.table(
        rewrites.map((r) => ({
          dpp: r.dppId,
          question: r.questionId,
          user: r.userId,
          from: r.marksAwarded,
          to: r.corrected,
        })),
      );
    }
    for (const entry of skipped) {
      console.log(`  · left: ${entry.row.dppId} / ${entry.row.questionId} (${entry.row.marksAwarded}) — ${entry.reason}`);
    }

    // 3. Attempts on the affected plans, recomputed from the corrected answers.
    const affectedPlanIds = [...new Set(rewrites.map((r) => r.dppId))];
    const attemptUpdates: { id: string; from: number; to: number; totalMarks: number }[] = [];

    if (affectedPlanIds.length > 0) {
      const attempts = await ogPool.query<{
        id: string;
        dpp_id: string;
        score: string | null;
        total_marks: string | null;
      }>(
        `SELECT id, dpp_id, score, total_marks
           FROM analytics.dpp_attempts
          WHERE dpp_id = ANY($1::text[]) AND score IS NOT NULL`,
        [affectedPlanIds],
      );

      // The corrected score is the sum over that plan's recorded answers;
      // unattempted questions contribute 0, exactly as they did at submit.
      const correctedByPlan = new Map<string, number>();
      for (const raw of results.rows) {
        if (!affectedPlanIds.includes(raw.dpp_id)) continue;
        const rewrite = rewrites.find(
          (r) => r.dppId === raw.dpp_id && r.questionId === raw.question_id,
        );
        const marks = rewrite ? rewrite.corrected : Number(raw.marks_awarded);
        correctedByPlan.set(raw.dpp_id, (correctedByPlan.get(raw.dpp_id) ?? 0) + marks);
      }

      for (const attempt of attempts.rows) {
        const corrected = correctedByPlan.get(attempt.dpp_id);
        if (corrected === undefined) continue;
        const from = Number(attempt.score);
        if (from === corrected) continue;
        attemptUpdates.push({
          id: attempt.id,
          from,
          to: Math.round(corrected * 100) / 100,
          totalMarks: Number(attempt.total_marks ?? 0),
        });
      }

      if (attemptUpdates.length > 0) {
        console.log(`\nAttempt rows to recompute: ${attemptUpdates.length}`);
        console.table(
          attemptUpdates.map((a) => ({
            attempt: a.id,
            score: `${a.from} → ${a.to}`,
            percentage: `${safePercentage(a.from, a.totalMarks)} → ${safePercentage(a.to, a.totalMarks)}`,
          })),
        );
      }
    }

    if (!APPLY) {
      console.log("\nDRY RUN — nothing was written. Re-run with --apply to commit.");
      return;
    }
    if (rewrites.length === 0 && attemptUpdates.length === 0) {
      console.log("\nNothing to apply.");
      return;
    }

    const client = await ogPool.connect();
    try {
      await client.query("BEGIN");
      for (const rewrite of rewrites) {
        await client.query(
          `UPDATE analytics.dpp_question_results
              SET marks_awarded = $1
            WHERE dpp_id = $2 AND question_id = $3 AND marks_awarded = $4`,
          [rewrite.corrected, rewrite.dppId, rewrite.questionId, rewrite.marksAwarded],
        );
      }
      for (const attempt of attemptUpdates) {
        await client.query(
          `UPDATE analytics.dpp_attempts SET score = $1, percentage = $2 WHERE id = $3`,
          [attempt.to, safePercentage(attempt.to, attempt.totalMarks), attempt.id],
        );
      }
      await client.query("COMMIT");
      console.log(`\nApplied: ${rewrites.length} answers, ${attemptUpdates.length} attempts.`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await userPool.end();
    await ogPool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Contest submit + finalize (plan Phase 4). Idempotent, exactly-once grading of
 * a rated attempt.
 *
 * Idempotency: the attempt row is locked with SELECT finished_at FOR UPDATE; if
 * already set, we bail ({alreadySubmitted:true}). Otherwise we claim finished_at
 * = NOW() in the SAME txn, so a concurrent manual + auto + sweep can't
 * double-grade. Grading is from the highest DURABLE draft (Redis buffer drained
 * to contest.answer_drafts first) against the FROZEN contest_questions snapshot,
 * and writes immutable contest.submission_answers. The count invariant
 * (correct+incorrect+unattempted == paper size) holds by construction.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import {
  gradeContest,
  type GradableQuestion,
  type SubmittedAnswer,
} from "@/lib/contest/grade";
import { normalizeScoringConfig } from "@/lib/contest/contest-config";
import { readContestDraft } from "./contest-draft-store";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type FinalizeReason = "manual" | "auto" | "deadline";

export interface SubmitResult {
  alreadySubmitted: boolean;
  score: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}

/**
 * Build the gradable question list from the frozen paper snapshot. Reads the
 * answer key straight from contest_questions.snapshot (immutable), so a later
 * OGCode edit can never change what was scored.
 */
async function loadFrozenPaper(contestId: string): Promise<GradableQuestion[]> {
  const res = await pool().query(
    `SELECT position, question_id, subject, snapshot, marks, negative_marks
       FROM contest.contest_questions WHERE contest_id = $1 ORDER BY position ASC`,
    [contestId],
  );
  return res.rows.map((row) => {
    const s = (row.snapshot ?? {}) as Record<string, unknown>;
    return {
      position: row.position,
      questionId: row.question_id,
      subject: row.subject,
      questionType: String(s.questionType ?? "mcq"),
      correctOption: typeof s.correctOption === "number" ? s.correctOption : null,
      correctOptions: Array.isArray(s.correctOptions) ? (s.correctOptions as number[]) : null,
      answerText: typeof s.answerText === "string" ? s.answerText : null,
      tolerance: typeof s.tolerance === "number" ? s.tolerance : null,
      matrixData: Array.isArray(s.matrixData) ? (s.matrixData as number[][]) : null,
      marks: row.marks,
      negativeMarks: row.negative_marks,
    };
  });
}

/**
 * Submit + grade an attempt exactly once. `reason` distinguishes manual vs the
 * automatic (deadline/sweep) finalize. Returns {alreadySubmitted:true} without
 * regrading if the attempt is already locked.
 */
export interface SubmitOptions {
  /** Client-reported anti-cheat violation count (tab-switch/blur strikes). */
  violationCount?: number;
  /** True when the 3-strike threshold was hit → flag the attempt for review
   *  (NOT a silent void — the score is still computed; an admin decides). */
  malpractice?: boolean;
}

export async function submitAttempt(
  contestId: string,
  userId: string,
  reason: FinalizeReason,
  opts: SubmitOptions = {},
): Promise<SubmitResult> {
  await ensureContestSchema();
  const violationCount = Math.max(0, Math.floor(Number(opts.violationCount) || 0));
  const reviewStatus = opts.malpractice ? "flagged" : "none";

  // Read the highest durable draft (the drain flushes Redis → answer_drafts; we
  // read the durable row here). If the buffer hasn't drained a very recent rev,
  // that write is simply not counted — the client is told to submit only after
  // its last save is acked, and the deadline sweep drains before finalizing.
  const draft = await readContestDraft(contestId, userId);
  const answers = (draft?.answers ?? {}) as Record<string, SubmittedAnswer>;

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT finished_at FROM contest.attempts WHERE contest_id = $1 AND user_id = $2 FOR UPDATE`,
      [contestId, userId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      const err = new Error("No attempt to submit.") as Error & { status: number };
      err.status = 404;
      throw err;
    }
    if (locked.rows[0].finished_at) {
      await client.query("ROLLBACK");
      return { alreadySubmitted: true, score: 0, correct: 0, incorrect: 0, unattempted: 0 };
    }

    // Grade from the frozen paper + scoring config.
    const [questions, scoringRow] = await Promise.all([
      loadFrozenPaper(contestId),
      client.query(`SELECT scoring_config, start_at FROM contest.contests WHERE id = $1`, [contestId]),
    ]);
    const config = normalizeScoringConfig(scoringRow.rows[0]?.scoring_config);
    const graded = gradeContest(questions, answers, config);

    // Claim finished_at + write the graded summary in the same txn. The score is
    // ALWAYS computed (flag-for-review, not a silent void); eligibility follows
    // review_status, which the rank/ORBIT batches filter on.
    await client.query(
      `UPDATE contest.attempts SET
         finished_at = NOW(),
         auto_submitted = $3,
         finalize_reason = $4,
         score = $5,
         correct_count = $6,
         incorrect_count = $7,
         unattempted_count = $8,
         section_scores = $9::jsonb,
         violation_count = GREATEST(contest.attempts.violation_count, $10),
         review_status = CASE WHEN $11 THEN 'flagged' ELSE contest.attempts.review_status END,
         eligibility = NOT ($11 OR contest.attempts.review_status IN ('flagged','upheld')),
         time_taken_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - started_at))::int),
         updated_at = NOW()
       WHERE contest_id = $1 AND user_id = $2`,
      [
        contestId,
        userId,
        reason !== "manual",
        reason,
        graded.score,
        graded.correct,
        graded.incorrect,
        graded.unattempted,
        JSON.stringify(graded.sectionScores),
        violationCount,
        reviewStatus === "flagged",
      ],
    );

    // Immutable per-question snapshots (batched multi-row insert).
    if (graded.perQuestion.length > 0) {
      const values: unknown[] = [];
      const rows: string[] = [];
      graded.perQuestion.forEach((pq, i) => {
        const b = i * 8;
        rows.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}::jsonb, $${b + 6}::jsonb, $${b + 7}, $${b + 8})`);
        const q = questions.find((x) => x.position === pq.position);
        // Persist the student's answer + correctness so (a) the post-contest
        // solutions review can show "your answer vs correct" and (b) the DPP-from-
        // mistakes query (WHERE is_correct = false) actually finds wrong answers.
        const submitted = answers[String(pq.position)] ?? null;
        values.push(
          contestId,
          userId,
          pq.position,
          pq.questionId,
          JSON.stringify(q ?? {}),
          submitted != null ? JSON.stringify(submitted) : null,
          pq.isCorrect,
          pq.marksAwarded,
        );
      });
      await client.query(
        `INSERT INTO contest.submission_answers
           (contest_id, user_id, position, question_id, question_snapshot, submitted_answer, is_correct, marks_awarded)
         VALUES ${rows.join(", ")}
         ON CONFLICT (contest_id, user_id, position) DO NOTHING`,
        values,
      );
    }

    await client.query("COMMIT");
    return {
      alreadySubmitted: false,
      score: graded.score,
      correct: graded.correct,
      incorrect: graded.incorrect,
      unattempted: graded.unattempted,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

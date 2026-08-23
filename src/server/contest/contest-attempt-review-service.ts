/**
 * Post-contest solutions review of a student's OWN attempt — each question with
 * their answer, the correct answer, and the explanation. Sourced entirely from
 * the immutable contest.submission_answers snapshots. Gated: results published +
 * the caller's own finished attempt (fail-closed).
 */

import { getUserPostgresReplicaPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresReplicaPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function reviewError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface AttemptReviewQuestion {
  position: number;
  subject: string | null;
  chapter: string | null;
  text: string;
  options: string[] | null;
  image: string | null;
  optionImages: (string | null)[] | null;
  submittedOption: number | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  isCorrect: boolean | null;
  marksAwarded: number | null;
  explanation: string | null;
}

export interface AttemptReview {
  contestName: string;
  questions: AttemptReviewQuestion[];
}

export async function getAttemptReview(contestId: string, userId: string): Promise<AttemptReview> {
  await ensureContestSchema();
  const p = pool();

  const contest = await p.query<{ status: string; name: string }>(
    `SELECT status, name FROM contest.contests WHERE id = $1`,
    [contestId],
  );
  if (!contest.rows[0]) throw reviewError(404, "Contest not found.");
  const status = contest.rows[0].status;
  if (status !== "result_published" && status !== "archived") {
    throw reviewError(403, "Solutions unlock once results are published.");
  }

  const rows = await p.query<{
    position: number;
    question_snapshot: Record<string, unknown>;
    submitted_answer: Record<string, unknown> | null;
    is_correct: boolean | null;
    marks_awarded: number | null;
  }>(
    `SELECT position, question_snapshot, submitted_answer, is_correct, marks_awarded
       FROM contest.submission_answers
      WHERE contest_id = $1 AND user_id = $2
      ORDER BY position ASC`,
    [contestId, userId],
  );
  if (rows.rows.length === 0) throw reviewError(403, "Only participants can review the solutions.");

  const questions: AttemptReviewQuestion[] = rows.rows.map((r) => {
    const s = (r.question_snapshot ?? {}) as {
      text?: string; options?: string[] | null; image?: string | null; optionImages?: (string | null)[] | null;
      correctOption?: number | null; correctOptions?: number[] | null; explanation?: string; subject?: string; chapter?: string;
    };
    const submitted = (r.submitted_answer ?? null) as { selectedOption?: number } | null;
    // Derive correctness from marks when the (older) row didn't persist is_correct.
    const derivedCorrect = r.is_correct ?? (r.marks_awarded != null ? r.marks_awarded > 0 : null);
    return {
      position: r.position,
      subject: s.subject ?? null,
      chapter: s.chapter ?? null,
      text: String(s.text ?? ""),
      options: Array.isArray(s.options) ? s.options : null,
      image: s.image ?? null,
      optionImages: Array.isArray(s.optionImages) ? s.optionImages : null,
      submittedOption: typeof submitted?.selectedOption === "number" ? submitted.selectedOption : null,
      correctOption: typeof s.correctOption === "number" ? s.correctOption : null,
      correctOptions: Array.isArray(s.correctOptions) ? s.correctOptions : null,
      isCorrect: derivedCorrect,
      marksAwarded: r.marks_awarded,
      explanation: s.explanation ?? null,
    };
  });

  return { contestName: contest.rows[0].name, questions };
}

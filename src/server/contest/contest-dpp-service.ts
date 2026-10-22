/**
 * Custom DPP-from-mistakes (plan Phase 8c). After results publish, a
 * participant can pull a personalised practice set built from the questions they
 * got WRONG in the contest: we read the wrong answers from the immutable
 * contest.submission_answers snapshots, derive the weak chapters, and source
 * FRESH OGCode questions on those chapters (excluding the contest's own
 * question ids so it's genuinely new practice).
 *
 * Gated (fail-closed): only after RESULT_PUBLISHED, only for a REGISTERED user,
 * and only for a PREMIUM-entitled one (live entitlement union — NOT the
 * is_premium mirror). A non-entitled user gets a locked response so the UI can
 * show "Subscribe to unlock".
 */

import { listOgcodeCatalogQuestionPage } from "@/server/ogcode-catalog";
import { getEntitledSubjects } from "@/server/entitlements";
import type { StoredQuestion } from "@/server/store";
import { getUserPostgresPool } from "@/server/user-postgres";

import { getContest } from "./contest-admin-service";
import { assertPracticeOpen, isOnUnreleasedPaper, unreleasedPaperQuestionIds } from "./contest-practice-service";
import { isRegisteredForContest } from "./contest-registration-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function dppError(status: number, message: string, code?: string): Error & { status: number; code?: string } {
  const err = new Error(message) as Error & { status: number; code?: string };
  err.status = status;
  if (code) err.code = code;
  return err;
}

export interface DppQuestion {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  chapter: string;
  questionType: string;
  image: string | null;
  optionImages: (string | null)[] | null;
}

type ContestDppLocked = {
  locked: true;
  reason: "not_registered" | "not_premium" | "not_published";
  entitledSubjects?: string[];
};

export type ContestDppResult =
  | ContestDppLocked
  | { locked: false; weakChapters: string[]; questions: DppQuestion[] };

/** The DPP with its full bank rows (incl. the answer key) — server-internal only. */
type ContestDppItems = ContestDppLocked | { locked: false; weakChapters: string[]; items: StoredQuestion[] };

/**
 * Build the custom DPP for a user's contest mistakes. Returns a locked marker
 * (for the UI to gate) rather than throwing on the entitlement/registration
 * gates, so the surface can render the "Subscribe to unlock" state.
 */
export async function getContestMistakeDpp(contestId: string, userId: string): Promise<ContestDppResult> {
  const dpp = await loadContestMistakeDpp(contestId, userId);
  if (dpp.locked) return dpp;
  const questions: DppQuestion[] = dpp.items.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    subject: q.subject,
    chapter: q.chapter,
    questionType: q.questionType,
    image: q.image ?? null,
    optionImages: q.optionImages ?? null,
  }));
  return { locked: false, weakChapters: dpp.weakChapters, questions };
}

async function loadContestMistakeDpp(contestId: string, userId: string): Promise<ContestDppItems> {
  await ensureContestSchema();
  const p = pool();

  // Only after results are published.
  const contest = await p.query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  if (!contest.rows[0]) throw dppError(404, "Contest not found.");
  const status = contest.rows[0].status;
  if (status !== "result_published" && status !== "archived") {
    return { locked: true, reason: "not_published" };
  }

  // Registered (authoritative row check).
  if (!(await isRegisteredForContest(contestId, userId))) {
    return { locked: true, reason: "not_registered" };
  }

  // Premium — live entitlement union (never the is_premium mirror).
  const entitled = await getEntitledSubjects(userId);
  if (entitled.length === 0) {
    return { locked: true, reason: "not_premium" };
  }

  // The wrong-answer questions from the immutable snapshot → weak chapters.
  const wrong = await p.query<{ question_snapshot: Record<string, unknown> }>(
    `SELECT question_snapshot FROM contest.submission_answers
      WHERE contest_id = $1 AND user_id = $2 AND is_correct = false`,
    [contestId, userId],
  );
  const weakChapters = Array.from(
    new Set(
      wrong.rows
        .map((r) => String((r.question_snapshot as { chapter?: string } | null)?.chapter ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (weakChapters.length === 0) {
    return { locked: false, weakChapters: [], items: [] };
  }

  // EXCLUDE this contest's own question ids (so the DPP is fresh practice) AND
  // every question on any unreleased paper (scheduled / result_processing) —
  // the DPP grades answers, so it must never carry another contest's paper.
  const contestIds = await p.query<{ question_id: string }>(
    `SELECT question_id FROM contest.contest_questions WHERE contest_id = $1`,
    [contestId],
  );
  const excludeIds = [
    ...new Set([...contestIds.rows.map((r) => r.question_id), ...(await unreleasedPaperQuestionIds())]),
  ];

  // Fresh questions on the weak chapters, scoped to the user's entitled subjects.
  const page = await listOgcodeCatalogQuestionPage({
    subjects: entitled as string[],
    chapters: weakChapters,
    excludeIds,
    type: "mcq", // DPP UI renders single-select MCQ (matches contest/practice)
    // Recommend OGCode questions AND practice-eligible admin-imported questions.
    contestPracticePool: true,
    limit: 20,
    offset: 0,
  });
  return { locked: false, weakChapters, items: page.items };
}

/** Feedback for one DPP answer (no tally — the DPP is pure extra practice). */
export interface DppAnswerResult {
  isCorrect: boolean;
  correctOption: number | null;
  correctOptions: number[] | null;
  explanation: string | null;
}

/**
 * Grade a single DPP answer server-side and return the reveal (correct option +
 * explanation). Gated exactly like the DPP itself — published + registered +
 * premium — so the answer key is never exposed to a non-entitled caller.
 *
 * Not an answer oracle: 409 while the contest runs (LIVE / ENDED /
 * RESULT_PROCESSING, same rule as practice), 403 for any question on an
 * unreleased paper, and the question resolves ONLY through this student's own
 * DPP item list — any other bank id is a 404, never graded.
 */
export async function gradeContestDppAnswer(
  contestId: string,
  userId: string,
  questionId: string,
  selectedOption: number,
): Promise<DppAnswerResult> {
  await ensureContestSchema();
  const contest = await getContest(contestId);
  if (!contest) throw dppError(404, "Contest not found.");
  assertPracticeOpen(contest);

  // Reuse the same gate as the DPP fetch (fail-closed).
  const dpp = await loadContestMistakeDpp(contestId, userId);
  if (dpp.locked) throw dppError(403, "This DPP is locked.", dpp.reason);

  if (await isOnUnreleasedPaper(questionId)) {
    throw dppError(403, "This question is part of a contest paper.");
  }

  const question = dpp.items.find((q) => q.id === questionId);
  if (!question) throw dppError(404, "Question not found.");
  const isCorrect =
    Array.isArray(question.correctOptions) && question.correctOptions.length > 0
      ? question.correctOptions.includes(selectedOption)
      : question.correctOption === selectedOption;
  return {
    isCorrect,
    correctOption: question.correctOption ?? null,
    correctOptions: question.correctOptions ?? null,
    explanation: question.explanation ?? null,
  };
}

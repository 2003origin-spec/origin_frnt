/**
 * Pre-contest practice (plan Phase 2c, contest-design §3). A registered-only
 * warm-up: questions sourced from the OGCode bank filtered to the contest's
 * admin-selected subjects/topics, graded server-side, tallied into
 * contest.practice_progress. Surfaces Contest Prep Score + Contest Accuracy.
 *
 * Practice is SEPARATE from the rated attempt — it never touches
 * contest.attempts / the leaderboard / ORBIT. Access requires an active
 * registration (reuse isRegisteredForContest, fail-closed).
 */

import {
  getOgcodeCatalogQuestionById,
  listOgcodeCatalogQuestionPage,
} from "@/server/ogcode-catalog";
import { getUserPostgresPool } from "@/server/user-postgres";

import { computePracticeMetrics, type PracticeMetrics } from "@/lib/contest/practice-score";
import { getContest } from "./contest-admin-service";
import { isRegisteredForContest } from "./contest-registration-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function practiceError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

async function requireRegistered(contestId: string, userId: string): Promise<void> {
  if (!(await isRegisteredForContest(contestId, userId))) {
    throw practiceError(403, "Register for the contest to unlock practice.");
  }
}

/** A practice question as the student sees it — no answer key. */
export interface PracticeQuestion {
  id: string;
  text: string;
  options: string[] | null;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
}

/**
 * Fetch a page of practice questions scoped to the contest's subjects/topics.
 * Sanitized (no answers). Requires registration.
 */
export async function getPracticeQuestions(
  contestId: string,
  userId: string,
  opts: { subject?: string | null; limit?: number; offset?: number } = {},
): Promise<{ items: PracticeQuestion[]; total: number }> {
  await requireRegistered(contestId, userId);
  const contest = await getContest(contestId);
  if (!contest) throw practiceError(404, "Contest not found.");

  // Scope to the contest's subjects (optionally one) and their admin-chosen
  // chapters (topics). An empty topics list for a subject = the whole subject.
  const subjects = opts.subject ? [opts.subject] : contest.subjects;
  if (subjects.length === 0) return { items: [], total: 0 };
  const chapters = subjects.flatMap((s) => contest.topics?.[s] ?? []);

  const page = await listOgcodeCatalogQuestionPage({
    subjects,
    chapters: chapters.length ? chapters : null,
    limit: Math.min(50, Math.max(1, opts.limit ?? 20)),
    offset: Math.max(0, opts.offset ?? 0),
  });

  const items: PracticeQuestion[] = page.items.map((q) => ({
    id: q.id,
    text: q.text,
    options: q.options,
    subject: q.subject,
    chapter: q.chapter,
    difficulty: q.difficulty,
    questionType: q.questionType,
    // answer key deliberately omitted
  }));
  return { items, total: page.total };
}

/** Grade a single-select MCQ answer against the stored key. */
function gradeMcq(q: { correctOption: number | null; correctOptions: number[] | null }, selected: number): boolean {
  if (Array.isArray(q.correctOptions) && q.correctOptions.length > 0) {
    return q.correctOptions.includes(selected);
  }
  return q.correctOption === selected;
}

/** The graded outcome of one practice answer + the refreshed metrics. */
export interface PracticeAttemptResult {
  isCorrect: boolean;
  correctOption: number | null;
  correctOptions: number[] | null;
  explanation: string | null;
  metrics: PracticeMetrics;
}

/**
 * Record a graded practice attempt and return the per-question feedback
 * (correct/wrong + the right option + explanation) plus the updated metrics.
 * Grades the MCQ server-side (authoritative). Requires registration.
 */
export async function recordPracticeAttempt(
  contestId: string,
  userId: string,
  questionId: string,
  selectedOption: number,
): Promise<PracticeAttemptResult> {
  await requireRegistered(contestId, userId);
  const contest = await getContest(contestId);
  if (!contest) throw practiceError(404, "Contest not found.");
  const question = await getOgcodeCatalogQuestionById(questionId);
  if (!question) throw practiceError(404, "Question not found.");

  const isCorrect = gradeMcq(question, selectedOption);
  // The OGCode question's subject can differ in CASING from the contest's
  // subject label; store the tally under the CONTEST's casing so
  // getPracticeMetrics (which keys off contest.subjects) finds it.
  const qSubject = question.subject || "Unknown";
  const subject =
    contest.subjects.find((s) => s.toLowerCase() === qSubject.toLowerCase()) ?? qSubject;

  await ensureContestSchema();
  // Atomic per-subject tally bump via a JSONB merge. Uses ON CONFLICT so the
  // first practice for a contest inserts, subsequent ones update.
  await pool().query(
    `INSERT INTO contest.practice_progress (contest_id, user_id, per_subject, attempted_count, correct_count)
     VALUES (
       $1, $2,
       jsonb_build_object($3::text, jsonb_build_object('attempted', 1, 'correct', $4::int)),
       1, $4::int
     )
     ON CONFLICT (contest_id, user_id) DO UPDATE SET
       per_subject = jsonb_set(
         contest.practice_progress.per_subject,
         ARRAY[$3::text],
         jsonb_build_object(
           'attempted', COALESCE((contest.practice_progress.per_subject -> $3 ->> 'attempted')::int, 0) + 1,
           'correct',   COALESCE((contest.practice_progress.per_subject -> $3 ->> 'correct')::int, 0) + $4::int
         ),
         true
       ),
       attempted_count = contest.practice_progress.attempted_count + 1,
       correct_count   = contest.practice_progress.correct_count + $4::int,
       updated_at      = NOW()`,
    [contestId, userId, subject, isCorrect ? 1 : 0],
  );

  const metrics = await getPracticeMetrics(contestId, userId);
  return {
    isCorrect,
    correctOption: question.correctOption ?? null,
    correctOptions: question.correctOptions ?? null,
    explanation: question.explanation ?? null,
    metrics,
  };
}

/** Current Prep Score + Accuracy + per-subject readiness. Requires registration. */
export async function getPracticeMetrics(contestId: string, userId: string): Promise<PracticeMetrics> {
  await requireRegistered(contestId, userId);
  const contest = await getContest(contestId);
  if (!contest) throw practiceError(404, "Contest not found.");
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT per_subject FROM contest.practice_progress WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
  const perSubject = (res.rows[0]?.per_subject ?? {}) as Record<string, unknown>;
  return computePracticeMetrics(contest.subjects, perSubject);
}

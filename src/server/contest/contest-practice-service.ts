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

import { listOgcodeCatalogQuestionPage } from "@/server/ogcode-catalog";
import type { StoredQuestion } from "@/server/store";
import { getUserPostgresPool } from "@/server/user-postgres";

import { resolveContestState, type ContestWindow } from "@/lib/contest/contest-state";
import { computePracticeMetrics, type PracticeMetrics } from "@/lib/contest/practice-score";
import { getContest, type ContestRecord } from "./contest-admin-service";
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
  // A waitlisted user may warm up too (they can still be promoted); practice
  // never touches the rated attempt and never serves paper questions.
  if (!(await isRegisteredForContest(contestId, userId, { includeWaitlisted: true }))) {
    throw practiceError(403, "Register for the contest to unlock practice.");
  }
}

/** The catalog filter that DEFINES the practice set (listing and grading share it). */
export function practiceFilter(contest: Pick<ContestRecord, "subjects" | "topics">, subject?: string | null) {
  // Scope to the contest's subjects (optionally one) and their admin-chosen
  // chapters (topics). An empty topics list for a subject = the whole subject.
  const subjects = subject ? [subject] : contest.subjects;
  const chapters = subjects.flatMap((s) => contest.topics?.[s] ?? []);
  return {
    subjects,
    chapters: chapters.length ? chapters : null,
    // Practice renders single-select MCQ only — match the contest paper.
    type: "mcq" as const,
    // OGCode questions AND practice-eligible admin imports; hidden contest
    // imports (contest_practice_eligible = FALSE) are never in the set.
    contestPracticePool: true,
  };
}

function toWindow(contest: Pick<ContestRecord, "status" | "regOpen" | "regClose" | "startAt" | "endAt">): ContestWindow {
  const d = (v: string | null) => (v ? new Date(v) : null);
  return {
    status: contest.status,
    regOpen: d(contest.regOpen),
    regClose: d(contest.regClose),
    startAt: d(contest.startAt),
    endAt: d(contest.endAt),
  };
}

/**
 * Practice is closed while the contest runs and until its results are out
 * (LIVE / ENDED / RESULT_PROCESSING → 409): graded practice feedback during the
 * contest is an answer oracle.
 */
export function assertPracticeOpen(
  contest: Pick<ContestRecord, "status" | "regOpen" | "regClose" | "startAt" | "endAt">,
  now: Date = new Date(),
): void {
  const state = resolveContestState(toWindow(contest), now);
  if (state === "LIVE" || state === "ENDED" || state === "RESULT_PROCESSING") {
    throw practiceError(409, "Practice is closed while the contest is running.");
  }
}

/**
 * Bank ids on ANY contest paper whose results are not yet out (scheduled —
 * upcoming, live or awaiting the pipeline — or result_processing). These must
 * never be graded through practice. Cheap: contest_questions is small.
 */
const UNRELEASED_PAPER_SQL = `
  SELECT DISTINCT cq.question_id
    FROM contest.contest_questions cq
    JOIN contest.contests c ON c.id = cq.contest_id
   WHERE c.status IN ('scheduled', 'result_processing')`;

export async function unreleasedPaperQuestionIds(): Promise<string[]> {
  await ensureContestSchema();
  const res = await pool().query<{ question_id: string }>(UNRELEASED_PAPER_SQL);
  return res.rows.map((r) => r.question_id);
}

export async function isOnUnreleasedPaper(questionId: string): Promise<boolean> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT 1 FROM (${UNRELEASED_PAPER_SQL}) p WHERE p.question_id = $1 LIMIT 1`,
    [questionId],
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Resolve a question ONLY through the practice-set filter, so an id outside the
 * set (a hidden contest import, another subject, a non-MCQ) is a 404 — never a
 * graded answer key.
 */
async function loadPracticeQuestion(contest: ContestRecord, questionId: string): Promise<StoredQuestion | null> {
  const page = await listOgcodeCatalogQuestionPage({
    ...practiceFilter(contest),
    includeIds: [questionId],
    limit: 1,
    offset: 0,
  });
  return page.items[0] ?? null;
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
  image: string | null;
  optionImages: (string | null)[] | null;
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
  assertPracticeOpen(contest);

  const filter = practiceFilter(contest, opts.subject);
  if (filter.subjects.length === 0) return { items: [], total: 0 };

  const page = await listOgcodeCatalogQuestionPage({
    ...filter,
    // Never suggest a question that sits on a not-yet-released contest paper.
    excludeIds: await unreleasedPaperQuestionIds(),
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
    image: q.image ?? null,
    optionImages: q.optionImages ?? null,
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
 * Grades the MCQ server-side (authoritative). Requires registration; closed
 * while the contest runs (409); refuses paper questions (403); resolves the
 * question only through the practice-set filter (404 outside it).
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
  assertPracticeOpen(contest);
  // A paper question must never be graded here (that returned the live paper's
  // answer key to any registrant — bug-fix C1).
  if (await isOnUnreleasedPaper(questionId)) {
    throw practiceError(403, "This question is part of a contest paper.");
  }
  const question = await loadPracticeQuestion(contest, questionId);
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

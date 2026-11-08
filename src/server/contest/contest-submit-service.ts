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
  snapshotMatrixPairs,
  type GradableQuestion,
  type SubmittedAnswer,
} from "@/lib/contest/grade";
import { normalizeScoringConfig } from "@/lib/contest/contest-config";
import { isContestWriteOpen, resolveFinalizeReason } from "@/lib/contest/submit-flow";
import { readContestDraft, saveContestDraft } from "./contest-draft-store";
import { ensureContestSchema } from "./contest-schema";
import { onContestWindowInvalidated } from "./contest-window-cache";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type FinalizeReason = "manual" | "auto" | "deadline";

export interface ContestWriteWindow {
  endAt: Date | null;
  /** DB clock (NOW()), so the deadline check never trusts a client/app clock. */
  serverNow: Date;
}

/**
 * The contest's fixed deadline + the DB clock, for the write gate on
 * /answers and the submit-carried final draft. Null when the contest is
 * unknown (callers treat that as closed).
 */
export async function getContestWriteWindow(contestId: string): Promise<ContestWriteWindow | null> {
  const res = await pool().query<{ end_at: Date | null; server_now: Date }>(
    `SELECT end_at, NOW() AS server_now FROM contest.contests WHERE id = $1`,
    [contestId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    endAt: row.end_at ? new Date(row.end_at) : null,
    serverNow: new Date(row.server_now),
  };
}

/** True while a contest write is still accepted (end_at + CONTEST_END_GRACE_SECONDS, DB clock). */
export function isWriteWindowOpen(window: ContestWriteWindow | null): boolean {
  return !!window && isContestWriteOpen(window.endAt, window.serverNow);
}

/**
 * Hot-path write gate for /answers and the submit-carried final draft, WITHOUT a
 * Neon read per autosave (spec 04 C4). end_at is cached per contest in-process
 * for WRITE_WINDOW_CACHE_TTL_MS and compared against the app clock (the
 * CONTEST_END_GRACE_SECONDS grace absorbs normal clock skew). The DB-clock check
 * stays authoritative inside submitAttempt's transaction.
 *
 *  - Cache says open → accept, no DB read.
 *  - Cache says closed (or miss/expired) → confirm against the DB (end_at +
 *    NOW()) and refresh. So an admin EXTENDING end_at can never wrongly close a
 *    live attempt; a confirmed-closed verdict is then cached for the TTL so a
 *    misbehaving client can't turn post-deadline saves into DB reads.
 *  - Concurrent misses for one contest share a single in-flight read.
 *
 * In-process only: misses cost about one read per instance per contest per TTL,
 * so a Redis layer would add staleness without removing meaningful load.
 */
export const WRITE_WINDOW_CACHE_TTL_MS = 15_000;

interface CachedWriteWindow {
  endAt: Date | null;
  /** True when the DB itself said the window is closed (or the contest is unknown). */
  closedConfirmed: boolean;
  expiresAt: number;
}

const writeWindowCache = new Map<string, CachedWriteWindow>();
const writeWindowInflight = new Map<string, Promise<ContestWriteWindow | null>>();
/** Bumped per contest on invalidation, so a read already in flight cannot write back a stale window. */
const writeWindowGeneration = new Map<string, number>();

// One invalidation clears every cached copy (contest-answer-key F9): when an
// admin ends, cancels or reschedules a contest, invalidateContestWindow drops
// this instance's write-window copy too, so a cached "open" stops accepting
// autosaves and final drafts at once instead of for up to the TTL. Other
// lambdas' copies still live up to WRITE_WINDOW_CACHE_TTL_MS.
onContestWindowInvalidated((contestId) => {
  writeWindowCache.delete(contestId);
  writeWindowInflight.delete(contestId);
  writeWindowGeneration.set(contestId, (writeWindowGeneration.get(contestId) ?? 0) + 1);
});

export interface WriteWindowGateDeps {
  load?: (contestId: string) => Promise<ContestWriteWindow | null>;
  now?: () => Date;
}

export async function isContestWriteWindowOpenCached(
  contestId: string,
  deps: WriteWindowGateDeps = {},
): Promise<boolean> {
  const load = deps.load ?? getContestWriteWindow;
  const now = (deps.now ?? (() => new Date()))();
  const cached = writeWindowCache.get(contestId);
  if (cached && cached.expiresAt > now.getTime()) {
    if (cached.closedConfirmed) return false;
    if (isContestWriteOpen(cached.endAt, now)) return true;
    // Closed by the cached end_at: confirm on the DB (end_at may have moved).
  }

  const generation = writeWindowGeneration.get(contestId) ?? 0;
  let pending = writeWindowInflight.get(contestId);
  if (!pending) {
    const started: Promise<ContestWriteWindow | null> = load(contestId).finally(() => {
      if (writeWindowInflight.get(contestId) === started) writeWindowInflight.delete(contestId);
    });
    pending = started;
    writeWindowInflight.set(contestId, pending);
  }
  const fresh = await pending;
  const open = isWriteWindowOpen(fresh);
  // An invalidation while this read was in flight means the row may have
  // changed under it: answer this caller, but do not cache the verdict.
  if ((writeWindowGeneration.get(contestId) ?? 0) === generation) {
    writeWindowCache.set(contestId, {
      endAt: fresh?.endAt ?? null,
      closedConfirmed: !open,
      expiresAt: now.getTime() + WRITE_WINDOW_CACHE_TTL_MS,
    });
  }
  return open;
}

/** Test hook: clear the in-process write-window cache. */
export function __resetContestWriteWindowCacheForTests(): void {
  writeWindowCache.clear();
  writeWindowInflight.clear();
  writeWindowGeneration.clear();
}

export interface SubmitFinalDraft {
  answers?: Record<string, unknown>;
  palette?: Record<string, unknown>;
  times?: Record<string, unknown>;
  rev: number;
}

export type ApplyFinalResult =
  | { applied: true; rev: number }
  | { applied: false; reason: "contest_ended" | "stale_draft" }
  | { applied: false; reason: string; code: number };

/**
 * Apply the final draft a submit carries, through the SAME rev CAS as
 * /answers: it lands only when its rev is strictly higher than the buffered
 * one (a stale rev means the buffer already holds something at least as new,
 * so it is ignored). Dropped entirely once the write window has closed —
 * grading then proceeds from the buffered draft. A non-409 rejection (bad
 * payload / too large) is returned with its code for the route to surface.
 */
export async function applySubmitFinal(
  contestId: string,
  userId: string,
  final: SubmitFinalDraft,
  writeWindowOpen: boolean,
): Promise<ApplyFinalResult> {
  if (!writeWindowOpen) return { applied: false, reason: "contest_ended" };
  const saved = await saveContestDraft(contestId, userId, final);
  if (saved.ok) return { applied: true, rev: saved.rev };
  if (saved.code === 409) return { applied: false, reason: "stale_draft" };
  return { applied: false, reason: saved.reason, code: saved.code };
}

export interface SubmitResult {
  alreadySubmitted: boolean;
  score: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}

/** Only the answer-spec field grading reads (G1: teacher tolerance, 0 ⇒ exact). */
function snapshotAnswerSpec(raw: unknown): GradableQuestion["answerSpec"] {
  if (!raw || typeof raw !== "object") return null;
  const tolerance = (raw as Record<string, unknown>).tolerance;
  return { tolerance: typeof tolerance === "number" && Number.isFinite(tolerance) ? tolerance : null };
}

/** One contest.contest_questions row as read for grading. */
export interface FrozenQuestionRow {
  position: number;
  question_id: string;
  subject: string | null;
  snapshot: unknown;
  marks: number | null;
  negative_marks: number | null;
}

/** Map one frozen paper row to the gradable shape (pure; unit-tested). */
export function gradableFromFrozenRow(row: FrozenQuestionRow): GradableQuestion {
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
    answerSpec: snapshotAnswerSpec(s.answerSpec),
    // The frozen matrixData is the OGCode `{ column_a, column_b, correct_pairs }`
    // object, not a pairs array — read the pairs out of it.
    matrixData: snapshotMatrixPairs(s.matrixData),
    marks: row.marks,
    negativeMarks: row.negative_marks,
  };
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
  return res.rows.map((row) => gradableFromFrozenRow(row as FrozenQuestionRow));
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

  // Grade from the Redis draft buffer (the read side; the drain to
  // answer_drafts is only the durable checkpoint). The client flushes its last
  // autosave before submitting, and /api/contest/submit applies the carried
  // `final` draft through the same rev CAS before calling here.
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
      client.query(
        `SELECT scoring_config, start_at, end_at, NOW() AS server_now FROM contest.contests WHERE id = $1`,
        [contestId],
      ),
    ]);
    const contestRow = scoringRow.rows[0];
    const config = normalizeScoringConfig(contestRow?.scoring_config);
    // Deadline decided on the DB clock inside the txn: a manual submit after
    // end_at + grace is still accepted (graded from the draft, as the sweep
    // would) but recorded truthfully as a deadline finalize.
    const endAt: Date | null = contestRow?.end_at ? new Date(contestRow.end_at) : null;
    const serverNow = contestRow?.server_now ? new Date(contestRow.server_now) : new Date();
    const effectiveReason = resolveFinalizeReason(reason, endAt, serverNow);
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
         time_taken_seconds = GREATEST(0, EXTRACT(EPOCH FROM (LEAST(NOW(), COALESCE($12::timestamptz, NOW())) - started_at))::int),
         updated_at = NOW()
       WHERE contest_id = $1 AND user_id = $2`,
      [
        contestId,
        userId,
        effectiveReason !== "manual",
        effectiveReason,
        graded.score,
        graded.correct,
        graded.incorrect,
        graded.unattempted,
        JSON.stringify(graded.sectionScores),
        violationCount,
        reviewStatus === "flagged",
        endAt ? endAt.toISOString() : null,
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

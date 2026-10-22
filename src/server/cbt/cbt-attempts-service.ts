/**
 * CBT test-run: sanitized delivery, autosave drafts, and server-authoritative
 * grading. Students never receive answers/explanations; grading always runs from
 * the server-held draft (never client-reported scores). Uses the shared grader
 * service when configured, with a deterministic local fallback.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { toAbsoluteMediaUrl } from "@/lib/media-url";
import { normalizeCbtOptions } from "@/lib/cbt/options";
import { cbtNumberText } from "@/lib/cbt/answer-format";
import { gradeMatrixPairs } from "@/lib/assessments/matrix-grade";
import { numbersMatch, resolveNumericTolerance } from "@/lib/assessments/numeric-tolerance";
import { parseStrictNumber } from "@/lib/assessments/parse-strict-number";
import {
  gradeAssessmentBatchWithService,
  type AssessmentBatchGradeItem,
  type GraderScoringPolicy,
} from "@/server/grader-client";
import type { StoredAnswerSpec, StoredQuestion, StoredUserAnswer } from "@/server/store";
import type { CbtParticipant, CbtRoom } from "@/lib/cbt/room-model";
import type { CbtQuestionAnswer, CbtQuestionType } from "@/lib/cbt/question-model";
import {
  isAnswered,
  type CbtPaletteStatus,
  type CbtSanitizedQuestion,
  type CbtStudentAnswer,
  type CbtTestPayload,
} from "@/lib/cbt/attempt-model";
import {
  CBT_PRESENCE_WINDOW_MS,
  deriveFinalizeReason,
  isGradedReason,
  type CbtFinalizeReason,
} from "@/lib/cbt/finalize-reason";
import { sanitizeQuestionTimes, type CbtQuestionTimes } from "@/lib/cbt/question-timing";
import { buildSectionScores, type CbtSectionInput } from "@/lib/cbt/sections";

import { shuffleQuestionsForParticipant } from "@/lib/cbt/shuffle";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtError, publishPresence, publishRoomEvent } from "./cbt-rooms-service";
import { recordParticipation } from "./cbt-quota-service";
import { readShuffleQuestions } from "./cbt-tests-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** cbtError plus a machine-readable code for the client to branch on. */
function codedError(status: number, message: string, code: string): Error & { status: number; code: string } {
  const err = cbtError(status, message) as Error & { status: number; code: string };
  err.code = code;
  return err;
}

export type TestQuestionRow = {
  position: number;
  questionId: string;
  questionType: CbtQuestionType;
  stem: string;
  image: string | null;
  options: { text: string; image?: string | null }[];
  answer: CbtQuestionAnswer;
  explanation: string | null;
  subject: string | null;
  chapter: string | null;
  marks: number;
  negativeMarks: number;
};

/** Whether this test is configured to shuffle questions per student. */
async function loadShuffleQuestions(testId: string): Promise<boolean> {
  const res = await pool().query(`SELECT settings FROM cbt.tests WHERE id = $1`, [testId]);
  return readShuffleQuestions(res.rows[0]?.settings);
}

async function loadTestQuestions(testId: string): Promise<TestQuestionRow[]> {
  const res = await pool().query(
    `SELECT tq.position, tq.marks, tq.negative_marks,
            q.id AS question_id, q.question_type, q.stem, q.image, q.options, q.answer,
            q.explanation, q.subject, q.chapter
       FROM cbt.test_questions tq
       JOIN cbt.questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1
      ORDER BY tq.position ASC`,
    [testId],
  );
  return res.rows.map((row) => ({
    position: Number(row.position),
    questionId: String(row.question_id),
    questionType: row.question_type as CbtQuestionType,
    stem: String(row.stem ?? ""),
    image: typeof row.image === "string" && row.image.trim() ? toAbsoluteMediaUrl(String(row.image).trim()) : null,
    options: normalizeCbtOptions(row.options),
    answer: (row.answer ?? {}) as CbtQuestionAnswer,
    explanation: row.explanation ?? null,
    subject: row.subject ?? null,
    chapter: row.chapter ?? null,
    marks: Number(row.marks ?? 4),
    negativeMarks: Number(row.negative_marks ?? -1),
  }));
}

// ── Sanitized delivery ───────────────────────────────────────────────────────

function sanitizeMatrixData(answer: CbtQuestionAnswer): Record<string, unknown> | undefined {
  const raw = answer.matrixData;
  if (!raw || typeof raw !== "object") return undefined;
  // Keep display structure (rows/columns/etc); strip anything resembling the key.
  const clone: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  delete clone.correct_pairs;
  delete clone.correctPairs;
  delete clone.correct;
  delete clone.answer;
  return clone;
}

export function sanitizeQuestionForStudent(q: TestQuestionRow): CbtSanitizedQuestion {
  const sanitized: CbtSanitizedQuestion = {
    position: q.position,
    questionId: q.questionId,
    questionType: q.questionType,
    stem: q.stem,
    image: q.image,
    options: q.options.map((o) => ({
      text: String(o?.text ?? ""),
      image: typeof o?.image === "string" && o.image.trim() ? o.image.trim() : null,
    })),
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    subject: q.subject,
    chapter: q.chapter,
  };
  if (q.questionType === "matrix_match") {
    const md = sanitizeMatrixData(q.answer);
    if (md) sanitized.matrixData = md;
  }
  return sanitized;
}

export async function getStudentTestPayload(participant: CbtParticipant, room: CbtRoom): Promise<CbtTestPayload> {
  await ensureCbtSchema();
  // `code` lets the player distinguish "your paper is already in" (→ thank-you
  // screen) from a genuine load failure (→ error screen with a retry).
  if (participant.finishedAt) throw codedError(409, "You have already submitted.", "already_submitted");
  if (room.status === "finished") throw codedError(409, "This test has ended.", "test_ended");
  if (room.status !== "in_test") throw cbtError(409, "The test has not started.");
  if (!room.testId || !room.startedAt || !room.durationSeconds) throw cbtError(409, "The test is not ready.");

  const [questions, shuffle] = await Promise.all([
    loadTestQuestions(room.testId),
    loadShuffleQuestions(room.testId),
  ]);
  const sections: { subject: string; questions: CbtSanitizedQuestion[] }[] = [];
  const bySubject = new Map<string, CbtSanitizedQuestion[]>();
  let maxScore = 0;
  for (const q of questions) {
    maxScore += q.marks;
    const subject = q.subject ?? "General";
    if (!bySubject.has(subject)) {
      const bucket: CbtSanitizedQuestion[] = [];
      bySubject.set(subject, bucket);
      sections.push({ subject, questions: bucket });
    }
    bySubject.get(subject)!.push(sanitizeQuestionForStudent(q));
  }

  // Per-student ordering happens here and ONLY here: each section's questions
  // are reordered for this participant while section order — and every
  // question's canonical `position` — stays as authored. Drafts, submissions,
  // and grading are all keyed by that position, so display order never reaches
  // the scoring path.
  if (shuffle) {
    for (const section of sections) {
      const ordered = shuffleQuestionsForParticipant(section.questions, participant.id, room.testId);
      section.questions.splice(0, section.questions.length, ...ordered);
    }
  }

  return {
    testId: room.testId,
    title: room.name,
    startedAt: room.startedAt,
    durationSeconds: room.durationSeconds,
    totalQuestions: questions.length,
    maxScore: Number(maxScore.toFixed(3)),
    sections,
  };
}

/**
 * Draft answers + palette for resume hydration (student's own only). `rev` is
 * the monotonic client revision the browser must echo back on the next save —
 * see saveAnswers for why.
 */
export async function loadDraft(
  roomId: string,
  participantId: string,
): Promise<{
  answers: Record<number, CbtStudentAnswer>;
  palette: Record<number, CbtPaletteStatus>;
  times: CbtQuestionTimes;
  rev: number;
}> {
  const res = await pool().query(
    `SELECT answers, palette, times, rev FROM cbt.answer_drafts WHERE room_id = $1 AND participant_id = $2`,
    [roomId, participantId],
  );
  const row = res.rows[0];
  return {
    answers: (row?.answers ?? {}) as Record<number, CbtStudentAnswer>,
    palette: (row?.palette ?? {}) as Record<number, CbtPaletteStatus>,
    times: sanitizeQuestionTimes(row?.times, Number.MAX_SAFE_INTEGER),
    rev: Number(row?.rev ?? 0),
  };
}

// ── Room time window ─────────────────────────────────────────────────────────

/** Grace after the deadline before the server takes over the submission. */
const FINALIZE_GRACE_SECONDS = 10;

/**
 * Pure mirror of the deadline predicate used by `roomWriteWindowOpen` and the
 * sweeps: the room-level clock (`started_at + duration_seconds`) plus grace.
 * Untimed rooms (no start or no duration) never expire. Boundary-inclusive:
 * exactly `end + grace` is still open, one millisecond later is not.
 */
export function cbtDeadlineExpired(
  startedAt: string | Date | null,
  durationSeconds: number | null,
  nowMs: number,
  graceSeconds = FINALIZE_GRACE_SECONDS,
): boolean {
  if (startedAt == null || durationSeconds == null) return false;
  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) return false;
  return nowMs > startMs + (durationSeconds + graceSeconds) * 1000;
}

/**
 * DB-clock deadline check: `started_at + duration + grace`. Null-safe (untimed
 * rooms never expire). Read fresh per request, so a teacher who extends
 * `duration_seconds` mid-test is honoured immediately. `room.status` alone is
 * not enough: it only flips to `finished` when the sweep / lazy finalize runs,
 * so a client with a frozen clock could keep writing after time-up.
 */
async function roomWriteWindowOpen(roomId: string): Promise<boolean> {
  const res = await pool().query(
    `SELECT (started_at IS NULL OR duration_seconds IS NULL
             OR NOW() <= started_at + (duration_seconds || ' seconds')::interval
                        + ($2 || ' seconds')::interval) AS open
       FROM cbt.rooms WHERE id = $1`,
    [roomId, String(FINALIZE_GRACE_SECONDS)],
  );
  return res.rows[0]?.open !== false;
}

// ── Autosave ─────────────────────────────────────────────────────────────────

const lastPresencePublish = new Map<string, number>();

function countAnswered(answers: Record<number, CbtStudentAnswer>): number {
  return Object.values(answers).filter((a) => isAnswered(a)).length;
}

/**
 * Persists the student's draft.
 *
 * `rev` is a monotonic counter owned by the browser. Without it, the last write
 * to land wins — so a tab left open on a dead laptop (or its `sendBeacon` fired
 * on pagehide) could overwrite the newer answers the student had just written
 * from the phone they resumed on. A save whose `rev` is below the stored one is
 * rejected with 409 `stale_draft`, and the client re-syncs from the server
 * instead of clobbering it. Clients that send no `rev` keep the old
 * last-write-wins behaviour, so an older bundle still works during a rollout.
 */
export async function saveAnswers(
  participant: CbtParticipant,
  room: CbtRoom,
  answers: Record<number, CbtStudentAnswer>,
  palette: Record<number, CbtPaletteStatus>,
  rev?: number,
  times?: unknown,
): Promise<{ answeredCount: number; rev: number }> {
  // Coded so the player stops retrying a save the server will never accept —
  // e.g. the deadline finalization landed while this tab was reconnecting.
  if (room.status !== "in_test") throw codedError(409, "The test is not active.", "test_ended");
  if (participant.finishedAt) throw codedError(409, "You have already submitted.", "already_submitted");
  // Past started_at + duration + grace: the player already handles `test_ended`
  // by stopping autosave and submitting; the server grades the last draft that
  // landed inside the window.
  if (!(await roomWriteWindowOpen(room.id))) {
    throw codedError(409, "Time is up — your answers are being submitted.", "test_ended");
  }

  // Cap the draft payload (~64KB each) so a malicious client can't bloat the row.
  const answersJson = JSON.stringify(answers ?? {});
  const paletteJson = JSON.stringify(palette ?? {});
  if (answersJson.length > 64 * 1024 || paletteJson.length > 64 * 1024) {
    throw codedError(413, "Answer payload too large.", "payload_too_large");
  }

  const answeredCount = countAnswered(answers);
  const incomingRev = Number.isFinite(Number(rev)) && Number(rev) > 0 ? Math.floor(Number(rev)) : null;

  // Per-question timing rides the same rev-guarded write, so it inherits the
  // stale-tab protection for free: the client always sends a CUMULATIVE map it
  // hydrated from the server, and a payload whose rev is behind is rejected
  // outright below. An EMPTY map is treated as "this client has nothing to say
  // about timing" and leaves the stored value alone — that is what keeps an
  // older bundle (which sends no `times` at all) from wiping a newer one during
  // a rollout.
  const incomingTimes = sanitizeQuestionTimes(times, room.durationSeconds ?? Number.MAX_SAFE_INTEGER);
  const timesJson = JSON.stringify(incomingTimes);

  const saved = await pool().query(
    `INSERT INTO cbt.answer_drafts (room_id, participant_id, answers, palette, times, rev, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $6::jsonb, COALESCE($5::bigint, 0), NOW())
     ON CONFLICT (room_id, participant_id)
       DO UPDATE SET answers = EXCLUDED.answers,
                     palette = EXCLUDED.palette,
                     times = CASE WHEN EXCLUDED.times = '{}'::jsonb
                                  THEN answer_drafts.times
                                  ELSE EXCLUDED.times END,
                     rev = GREATEST(answer_drafts.rev, EXCLUDED.rev),
                     updated_at = NOW()
       WHERE $5::bigint IS NULL OR EXCLUDED.rev >= answer_drafts.rev
     RETURNING rev`,
    [room.id, participant.id, answersJson, paletteJson, incomingRev, timesJson],
  );

  if (!saved.rows[0]) {
    // The stored draft is newer than this payload — surface the current rev so
    // the client can re-hydrate rather than retry the stale body forever.
    const current = await pool().query(
      `SELECT rev FROM cbt.answer_drafts WHERE room_id = $1 AND participant_id = $2`,
      [room.id, participant.id],
    );
    const err = cbtError(409, "A newer version of your answers is already saved.") as Error & {
      status: number;
      code?: string;
      rev?: number;
    };
    err.code = "stale_draft";
    err.rev = Number(current.rows[0]?.rev ?? 0);
    throw err;
  }

  await pool().query(
    `UPDATE cbt.room_participants SET answered_count = $3, last_seen_at = NOW(),
            entered_test_at = COALESCE(entered_test_at, NOW())
       WHERE id = $1 AND room_id = $2`,
    [participant.id, room.id, answeredCount],
  );

  // E5 — the participation meter. The first autosave lands as soon as the student
  // presses "Enter Full-screen & Begin", so this covers a student whose
  // heartbeat never made it. Idempotent (PK on participant_id) and it swallows
  // its own failures: quota bookkeeping must never break a live attempt.
  await recordParticipation(participant.id, room.id);

  // Coalesced presence re-publish (≥5s) so the teacher's progress column moves
  // without a publish per keystroke.
  const now = Date.now();
  if (now - (lastPresencePublish.get(room.id) ?? 0) >= 5000) {
    lastPresencePublish.set(room.id, now);
    await publishPresence(room.id, room.status);
  }
  return { answeredCount, rev: Number(saved.rows[0].rev ?? 0) };
}

// ── Grading ──────────────────────────────────────────────────────────────────

type GradeOutcome = { marksAwarded: number; isCorrect: boolean; needsReview: boolean };

function normalizeExpr(text: string | null | undefined): string {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "").replace(/\*/g, "");
}

function scoreObjective(correct: boolean, answered: boolean, marks: number, negativeMarks: number): number {
  if (correct) return marks;
  if (answered) return negativeMarks;
  return 0;
}

/**
 * P6: CBT's numeric rule is the grader's (G1): the stored tolerance (0 ⇒
 * exact); with none (legacy NULL rows) an integer key is exact and a decimal key
 * is exact after rounding the answer to the key's decimal places, never a 1%
 * default. `keyText` / `submittedText` are the numbers as typed (cbtNumberText).
 */
export function cbtNumbersMatch(
  keyText: string,
  submittedText: string | null,
  tolerance: number | null | undefined,
): boolean {
  const expected = parseStrictNumber(keyText);
  const submitted = submittedText === null ? null : parseStrictNumber(submittedText);
  if (expected === null || submitted === null) return false;
  const rule = resolveNumericTolerance({ tolerance: tolerance ?? null }, keyText);
  return numbersMatch(expected, submitted, rule.tolerance, keyText, rule.kind, submittedText);
}

function isCbtNumericType(questionType: CbtQuestionType): boolean {
  return questionType === "numerical" || questionType === "numerical_with_units";
}

/**
 * M3 — what the grader service is sent for a CBT numerical /
 * numerical_with_units question, so it applies CBT's rule exactly as
 * gradeCbtLocal does whether or not the service is up:
 *  - the unit is a display label: key and student are reduced to their one
 *    strictly parsed number ("5 cm" → "5"); an answer that is not exactly one
 *    number is sent as typed and fails the service's strict parse, as locally;
 *  - the key and the answer keep their typed digits ("9.80"), and the stored
 *    tolerance is sent as is: with none, the service's integer / decimal-exact
 *    rule applies, which is exactly what gradeCbtLocal does (P6);
 *  - an explicit `numerical` answer spec is attached, so neither the derived
 *    units mode nor a stored grader.answer_specs row (keyed by question id,
 *    possibly saved with the unit inside the number) is used.
 */
export function cbtNumericGraderView(
  answer: CbtQuestionAnswer,
  student: CbtStudentAnswer,
): { answerText: string | null; tolerance: number | null; answerSpec: StoredAnswerSpec; studentAnswerText: string | null } {
  const expectedText = cbtNumberText(answer.answerText) ?? answer.answerText ?? null;
  const tolerance = answer.tolerance ?? null;
  return {
    answerText: expectedText,
    tolerance,
    answerSpec: { gradingMode: "numerical", expectedValue: expectedText, tolerance },
    studentAnswerText: cbtNumberText(student.answerText) ?? student.answerText ?? null,
  };
}

export function gradeCbtLocal(
  questionType: CbtQuestionType,
  answer: CbtQuestionAnswer,
  student: CbtStudentAnswer,
  marks: number,
  negativeMarks: number,
): GradeOutcome {
  const answered = isAnswered(student);

  switch (questionType) {
    case "mcq": {
      const correct = typeof answer.correctOption === "number" && student.selectedOption === answer.correctOption;
      return { marksAwarded: scoreObjective(correct, answered, marks, negativeMarks), isCorrect: correct, needsReview: false };
    }
    case "msq": {
      const expected = [...(answer.correctOptions ?? [])].sort((a, b) => a - b);
      const submitted = [...(student.selectedOptions ?? [])].sort((a, b) => a - b);
      const correct = expected.length > 0 && JSON.stringify(expected) === JSON.stringify(submitted);
      const subset = submitted.length > 0 && submitted.every((o) => expected.includes(o));
      const credit = correct ? 1 : subset && expected.length > 0 ? submitted.length / expected.length : 0;
      const marksAwarded = credit > 0 ? Number((credit * marks).toFixed(3)) : answered ? negativeMarks : 0;
      return { marksAwarded, isCorrect: correct, needsReview: false };
    }
    case "numerical":
    case "numerical_with_units": {
      // Bug-fix G2: ONE strictly parsed number per side (fractions, ×10^n, e/E,
      // unicode minus, thousands); "2 3" / "2 or 3" are wrong, never "first
      // number wins". The unit stays a display label (not compared) and the
      // tolerance rule is the grader's (P6, see cbtNumbersMatch).
      const keyText = cbtNumberText(answer.answerText);
      if (keyText === null) {
        // Unparseable answer key: a tooling gap, not the student's fault.
        return { marksAwarded: 0, isCorrect: false, needsReview: answered };
      }
      const correct = cbtNumbersMatch(keyText, cbtNumberText(student.answerText), answer.tolerance);
      return { marksAwarded: scoreObjective(correct, answered, marks, negativeMarks), isCorrect: correct, needsReview: false };
    }
    case "matrix_match": {
      // Bug-fix G3: any wrong pair ⇒ wrong (negative); partial credit only for
      // a subset, per fully-correct row. Ticking every cell used to score full.
      // M4 (P7): only a wrong pair is negative; correct pairs with no complete
      // row score 0, as the grader service does.
      const matrix = gradeMatrixPairs(answer.matrixData?.correct_pairs as number[][] | undefined, student.matrixPairs, "fractional");
      const credit = matrix.creditAwarded;
      const marksAwarded = credit > 0 ? Number((credit * marks).toFixed(3)) : matrix.hasWrongPair && answered ? negativeMarks : 0;
      return { marksAwarded, isCorrect: matrix.isCorrect, needsReview: false };
    }
    case "symbolic_expression":
    case "equation": {
      // Local fallback can only trust an exact normalized match; anything else is
      // flagged for review rather than penalized.
      const correct = answered && normalizeExpr(student.answerText) === normalizeExpr(answer.answerText);
      if (correct) return { marksAwarded: marks, isCorrect: true, needsReview: false };
      return { marksAwarded: 0, isCorrect: false, needsReview: answered };
    }
    case "subjective":
    default:
      return { marksAwarded: 0, isCorrect: false, needsReview: answered };
  }
}

function toStoredQuestion(q: TestQuestionRow): StoredQuestion {
  const base = toPlainStoredQuestion(q);
  if (!isCbtNumericType(q.questionType)) return base;
  const view = cbtNumericGraderView(q.answer, {});
  return {
    ...base,
    questionType: "numerical",
    answerText: view.answerText,
    tolerance: view.tolerance,
    answerSpec: view.answerSpec,
  } as StoredQuestion;
}

function toPlainStoredQuestion(q: TestQuestionRow): StoredQuestion {
  return {
    id: q.questionId,
    questionType: q.questionType,
    text: q.stem,
    options: q.options.map((o) => String(o?.text ?? "")),
    correctOption: q.answer.correctOption ?? null,
    correctOptions: q.answer.correctOptions ?? [],
    matrixData: q.answer.matrixData ?? null,
    answerText: q.answer.answerText ?? null,
    tolerance: q.answer.tolerance ?? null,
    explanation: q.explanation,
    subject: q.subject,
    chapter: q.chapter,
    concept: null,
    hint: null,
  } as unknown as StoredQuestion;
}

function toStoredAnswer(student: CbtStudentAnswer): StoredUserAnswer {
  return {
    answerText: student.answerText ?? null,
    selectedOption: student.selectedOption ?? null,
    selectedOptions: student.selectedOptions ?? [],
    matrixPairs: student.matrixPairs ?? [],
    timeSpent: 0,
  } as unknown as StoredUserAnswer;
}

/** One grader-service batch item for a CBT question (numeric ones normalised, see cbtNumericGraderView). */
export function buildCbtGraderItem(q: TestQuestionRow, student: CbtStudentAnswer): AssessmentBatchGradeItem {
  const scoringPolicy: GraderScoringPolicy = {
    correctMarks: q.marks,
    incorrectMarks: q.negativeMarks,
    unattemptedMarks: 0,
    partialCreditPolicy: "fractional",
    negativeMarkingMode: "answered_only",
  };
  const answer = isCbtNumericType(q.questionType)
    ? { ...student, answerText: cbtNumericGraderView(q.answer, student).studentAnswerText }
    : student;
  return {
    question: toStoredQuestion(q),
    answer: toStoredAnswer(answer),
    attemptRef: String(q.position),
    scoringPolicy,
  };
}

async function gradeAll(
  roomId: string,
  participantId: string,
  questions: TestQuestionRow[],
  answers: Record<number, CbtStudentAnswer>,
): Promise<{ position: number; outcome: GradeOutcome }[]> {
  // Try the remote grader for the whole batch; fall back locally on null.
  let remote: Awaited<ReturnType<typeof gradeAssessmentBatchWithService>> = null;
  try {
    const items: AssessmentBatchGradeItem[] = questions.map((q) => buildCbtGraderItem(q, answers[q.position] ?? {}));
    remote = await gradeAssessmentBatchWithService({
      userId: participantId,
      assessmentId: roomId,
      assessmentType: "cbt",
      items,
    });
  } catch {
    remote = null; // contract errors → local fallback (never fail a submission)
  }

  const remoteByRef = new Map<string, { marksAwarded: number; isCorrect: boolean; needsReview: boolean }>();
  if (remote) {
    for (const r of remote) {
      const ref = r.attemptRef ?? r.questionId;
      remoteByRef.set(String(ref), {
        marksAwarded: r.marksAwarded,
        isCorrect: r.isCorrect,
        needsReview: r.needsReview,
      });
    }
  }

  return questions.map((q) => {
    const remoteHit = remoteByRef.get(String(q.position));
    const outcome: GradeOutcome = remoteHit
      ? { marksAwarded: remoteHit.marksAwarded, isCorrect: remoteHit.isCorrect, needsReview: remoteHit.needsReview }
      : gradeCbtLocal(q.questionType, q.answer, answers[q.position] ?? {}, q.marks, q.negativeMarks);
    return { position: q.position, outcome };
  });
}

async function persistRanks(roomId: string): Promise<void> {
  await pool().query(
    `WITH ranked AS (
       SELECT id, RANK() OVER (
         ORDER BY score DESC NULLS LAST, time_taken_seconds ASC NULLS LAST
       ) AS rnk
       FROM cbt.room_participants
       WHERE room_id = $1 AND finished_at IS NOT NULL
     )
     UPDATE cbt.room_participants p SET rank = ranked.rnk
       FROM ranked WHERE p.id = ranked.id AND p.room_id = $1`,
    [roomId],
  );
}

export type CbtGradingStatus = "pending" | "done" | "failed";

/** Grading tries before an attempt is parked as 'failed' for the teacher. */
export const GRADING_MAX_ATTEMPTS = 5;

/**
 * A first grading pass that is still running is also 'pending'; the sweep
 * leaves a claim alone for this long so it never races it.
 */
const REGRADE_MIN_AGE_SECONDS = 20;

/**
 * L7 — wait before the regrade sweep tries a row again after its Nth failure
 * (`grading_next_attempt_at`). Exponential, so a database blip spreads the
 * GRADING_MAX_ATTEMPTS tries over ~40 minutes instead of burning them in one
 * minute across instances. Only the first GRADING_MAX_ATTEMPTS - 1 entries are
 * reachable today (the last failure parks the row as 'failed').
 */
export const GRADING_RETRY_BACKOFF_SECONDS = [30, 120, 480, 1800, 7200] as const;

/**
 * While one caller grades a row its next attempt is pushed this far out, so a
 * concurrent sweep on another instance skips it (and a crashed grader's row
 * comes due again on its own). Longer than FINALIZE_BUDGET_MS plus one grade.
 */
export const GRADING_LEASE_SECONDS = 120;

/** Lazy regrade from a teacher read: small, so the page never waits long. */
const TEACHER_READ_REGRADE_LIMIT = 10;
const TEACHER_READ_REGRADE_BUDGET_MS = 10_000;

/**
 * M7 — a 'pending' attempt older than this is treated as stuck: the teacher
 * may retry it by hand instead of waiting for the cron sweep (which may not be
 * running, and the lazy regrade only fires while the room is in_test).
 */
export const STUCK_PENDING_GRADING_SECONDS = 60;

/**
 * SQL predicate (on cbt.room_participants columns) for "the teacher may retry
 * grading now": parked as 'failed', or 'pending' for longer than
 * STUCK_PENDING_GRADING_SECONDS. Evaluated on the database clock, and shared
 * by the retry UPDATE and the leaderboard read so the button and the action
 * can never disagree.
 */
export const TEACHER_RETRYABLE_GRADING_SQL = `(grading_status = 'failed' OR (grading_status = 'pending' AND finished_at < NOW() - INTERVAL '${STUCK_PENDING_GRADING_SECONDS} seconds'))`;

export type SubmitAttemptOptions = {
  /** Legacy flag kept for callers that only know "the student didn't press it". */
  auto?: boolean;
  /** Why this attempt is ending. Defaults from `auto` when not given. */
  reason?: CbtFinalizeReason;
  /** Integrity strikes reported by the player (malpractice submissions). */
  violationCount?: number;
  /**
   * Skip the room-wide rank recompute. The sweep sets this and re-ranks once at
   * the end — otherwise finalizing 200 students re-ranks the room 200 times.
   */
  deferRanks?: boolean;
};

export type SubmitAttemptResult = {
  alreadySubmitted: boolean;
  score?: number;
  maxScore?: number;
  reason?: CbtFinalizeReason;
  /**
   * Where grading stands. 'pending' means the attempt is safely recorded but
   * its score is still owed — the CBT sweep grades it (never a dead end).
   */
  gradingStatus?: CbtGradingStatus;
};

export async function submitAttempt(
  participant: CbtParticipant,
  room: CbtRoom,
  opts: SubmitAttemptOptions = {},
): Promise<SubmitAttemptResult> {
  await ensureCbtSchema();
  if (!room.testId) throw cbtError(409, "This room has no test.");

  let reason: CbtFinalizeReason = opts.reason ?? (opts.auto ? "timer" : "manual");
  // A "manual" submit that arrives after started_at + duration + grace is
  // accepted (never rejected: the draft it grades was itself deadline-gated),
  // but recorded truthfully as a timer finalize.
  if (reason === "manual" && !(await roomWriteWindowOpen(room.id))) reason = "timer";
  const autoSubmitted = reason !== "manual";
  const violationCount = Math.max(0, Math.floor(Number(opts.violationCount) || 0));
  const graded = isGradedReason(reason);

  // Idempotency guard: lock the participant row and bail if already finished.
  const client = await pool().connect();
  let shouldGrade = false;
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT finished_at, grading_status FROM cbt.room_participants WHERE id = $1 AND room_id = $2 FOR UPDATE`,
      [participant.id, room.id],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      throw cbtError(404, "Participant not found.");
    }
    if (locked.rows[0].finished_at) {
      await client.query("ROLLBACK");
      return { alreadySubmitted: true, gradingStatus: toGradingStatus(locked.rows[0].grading_status) };
    }
    // Claim the submission immediately so a concurrent auto+manual can't
    // double-grade. 'pending' records that a score is now owed: if grading
    // below fails, the sweep still knows to come back for this row.
    await client.query(
      `UPDATE cbt.room_participants
          SET finished_at = NOW(), auto_submitted = $3, finalize_reason = $4,
              violation_count = GREATEST(violation_count, $5),
              grading_status = CASE WHEN $6::boolean THEN 'pending' ELSE 'done' END,
              grading_attempts = 0, grading_error = NULL, grading_next_attempt_at = NULL
        WHERE id = $1 AND room_id = $2`,
      [participant.id, room.id, autoSubmitted, reason, violationCount, graded],
    );
    await client.query("COMMIT");
    shouldGrade = true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  if (!shouldGrade) return { alreadySubmitted: true };

  // A true no-show (never opened the paper, no draft) is recorded as finished so
  // the room can close, but deliberately left ungraded: a blank score is how the
  // teacher tells "absent" apart from "sat the test and scored 0".
  if (!graded) {
    await publishRoomEvent(room.id, {
      type: "participant_finished",
      participant_id: participant.id,
      student_code: participant.studentCode,
    });
    if (!opts.deferRanks) await maybeFinishRoom(room.id);
    return { alreadySubmitted: false, reason, gradingStatus: "done" };
  }

  // The attempt is committed; a grading failure from here on is recorded on the
  // row (pending → the sweep retries; failed after GRADING_MAX_ATTEMPTS) and
  // NOT thrown, so the student is told "submitted" — which is true — instead of
  // getting an error, retrying, and hitting a bare `alreadySubmitted`.
  const outcome = await gradeOrRecordFailure(room, participant);

  if (outcome.ok && !opts.deferRanks) await persistRanks(room.id);
  await publishRoomEvent(room.id, {
    type: "participant_finished",
    participant_id: participant.id,
    student_code: participant.studentCode,
  });

  if (!opts.deferRanks) await maybeFinishRoom(room.id);

  if (!outcome.ok) return { alreadySubmitted: false, reason, gradingStatus: outcome.gradingStatus };
  return {
    alreadySubmitted: false,
    score: outcome.score,
    maxScore: outcome.maxScore,
    reason,
    gradingStatus: "done",
  };
}

function toGradingStatus(value: unknown): CbtGradingStatus {
  return value === "pending" || value === "failed" ? value : "done";
}

type GradeOutcomeResult =
  | { ok: true; score: number; maxScore: number }
  | { ok: false; gradingStatus: CbtGradingStatus; error: unknown };

/**
 * Runs `gradeFinishedParticipant`; on failure bumps `grading_attempts`, stores
 * the error, schedules the next try per GRADING_RETRY_BACKOFF_SECONDS, and
 * parks the row as 'failed' once the cap is reached. Only a row still
 * 'pending' is touched, so a concurrent success is never overwritten.
 */
async function gradeOrRecordFailure(
  room: CbtRoom,
  participant: Pick<CbtParticipant, "id" | "studentCode">,
): Promise<GradeOutcomeResult> {
  try {
    const graded = await gradeFinishedParticipant(room, participant);
    return { ok: true, ...graded };
  } catch (error) {
    console.error(`[cbt] grading failed for participant ${participant.id}`, error);
    let gradingStatus: CbtGradingStatus = "pending";
    try {
      const res = await pool().query(
        `UPDATE cbt.room_participants
            SET grading_attempts = grading_attempts + 1,
                grading_error = LEFT($3, 500),
                grading_status = CASE WHEN grading_attempts + 1 >= $4 THEN 'failed' ELSE 'pending' END,
                grading_next_attempt_at = NOW() + make_interval(
                  secs => ($5::int[])[LEAST(grading_attempts + 1, cardinality($5::int[]))]
                )
          WHERE id = $1 AND room_id = $2 AND grading_status = 'pending'
          RETURNING grading_status`,
        [
          participant.id,
          room.id,
          String((error as Error)?.message ?? error),
          GRADING_MAX_ATTEMPTS,
          [...GRADING_RETRY_BACKOFF_SECONDS],
        ],
      );
      if (res.rows[0]) gradingStatus = toGradingStatus(res.rows[0].grading_status);
    } catch (recordError) {
      // The row is still 'pending' from the claim, so the sweep retries anyway.
      console.error(`[cbt] could not record grading failure for ${participant.id}`, recordError);
    }
    return { ok: false, gradingStatus, error };
  }
}

/**
 * Grades one CLAIMED attempt (finished_at already set) from the server-held
 * draft and writes the score with `grading_status = 'done'`. Idempotent: the
 * per-question rows upsert and the final UPDATE overwrites, so the regrade
 * sweep can safely re-run it after a partial failure. `time_taken_seconds` is
 * measured to `finished_at`, not to "now", so a late regrade does not inflate it.
 */
export async function gradeFinishedParticipant(
  room: CbtRoom,
  participant: Pick<CbtParticipant, "id" | "studentCode">,
): Promise<{ score: number; maxScore: number }> {
  if (!room.testId) throw cbtError(409, "This room has no test.");
  const draftRes = await pool().query(
    `SELECT answers, times FROM cbt.answer_drafts WHERE room_id = $1 AND participant_id = $2`,
    [room.id, participant.id],
  );
  const answers = (draftRes.rows[0]?.answers ?? {}) as Record<number, CbtStudentAnswer>;
  // Advisory per-question seconds, clamped to the room duration. Attempts that
  // finished before this shipped simply have none, and every reader treats a
  // missing entry as "not recorded" rather than as zero seconds.
  const questionTimes = sanitizeQuestionTimes(
    draftRes.rows[0]?.times,
    room.durationSeconds ?? Number.MAX_SAFE_INTEGER,
  );
  const questions = await loadTestQuestions(room.testId);
  const grades = await gradeAll(room.id, participant.id, questions, answers);

  let score = 0;
  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  const qByPos = new Map(questions.map((q) => [q.position, q]));
  // Sectional marking is assembled from the SAME grading pass, so the per-
  // subject rows can never disagree with the total written just below.
  const sectionInput: CbtSectionInput[] = [];

  for (const { position, outcome } of grades) {
    score += outcome.marksAwarded;
    const q = qByPos.get(position)!;
    sectionInput.push({
      position,
      subject: q.subject,
      marks: q.marks,
      marksAwarded: outcome.marksAwarded,
      isCorrect: outcome.isCorrect,
      needsReview: outcome.needsReview,
      attempted: isAnswered(answers[position] ?? {}),
      timeSeconds: questionTimes[position] ?? 0,
    });
    await pool().query(
      `INSERT INTO cbt.submission_answers
         (room_id, participant_id, position, question_snapshot, submitted_answer, grading_result,
          marks_awarded, time_spent_seconds)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
       ON CONFLICT (room_id, participant_id, position) DO UPDATE
         SET submitted_answer = EXCLUDED.submitted_answer,
             grading_result = EXCLUDED.grading_result,
             marks_awarded = EXCLUDED.marks_awarded,
             time_spent_seconds = EXCLUDED.time_spent_seconds`,
      [
        room.id,
        participant.id,
        position,
        JSON.stringify({
          questionId: q.questionId,
          questionType: q.questionType,
          stem: q.stem,
          image: q.image,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          subject: q.subject,
          chapter: q.chapter,
        }),
        JSON.stringify(answers[position] ?? {}),
        JSON.stringify({ isCorrect: outcome.isCorrect, needsReview: outcome.needsReview }),
        Number(outcome.marksAwarded.toFixed(3)),
        questionTimes[position] ?? 0,
      ],
    );
  }

  const answeredCount = countAnswered(answers);

  await pool().query(
    `UPDATE cbt.room_participants
        SET score = $3, max_score = $4, answered_count = $5,
            time_taken_seconds = CASE WHEN $6::timestamptz IS NULL THEN 0
              ELSE LEAST($7::bigint, GREATEST(0, ROUND(EXTRACT(EPOCH FROM
                     (COALESCE(finished_at, NOW()) - $6::timestamptz)))))::int END,
            section_scores = $8::jsonb, last_seen_at = NOW(),
            grading_status = 'done', grading_error = NULL
      WHERE id = $1 AND room_id = $2`,
    [
      participant.id,
      room.id,
      Number(score.toFixed(3)),
      Number(maxScore.toFixed(3)),
      answeredCount,
      room.startedAt,
      room.durationSeconds ?? 2_147_483_647,
      JSON.stringify(buildSectionScores(sectionInput)),
    ],
  );

  return { score: Number(score.toFixed(3)), maxScore: Number(maxScore.toFixed(3)) };
}

/** Finishes the room + broadcasts test_ended once every active participant is done. */
export async function maybeFinishRoom(roomId: string): Promise<void> {
  const res = await pool().query(
    `SELECT COUNT(*) FILTER (WHERE finished_at IS NULL AND kicked = FALSE) AS pending
       FROM cbt.room_participants WHERE room_id = $1`,
    [roomId],
  );
  if (Number(res.rows[0]?.pending ?? 0) > 0) return;
  const upd = await pool().query(
    `UPDATE cbt.rooms SET status = 'finished', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'in_test' RETURNING id`,
    [roomId],
  );
  if (upd.rows[0]) await publishRoomEvent(roomId, { type: "test_ended" });
}

// ── Finalization (deadline, teacher-forced, room close) ──────────────────────

const ROOM_SWEEP_COLUMNS = `id, teacher_id, name, public_slug, status, test_id, started_at,
  duration_seconds, ended_at, capacity, rejoin_policy, report_share_enabled, created_at, updated_at`;

/** Concurrency for grading a room's stragglers (each one hits the grader service). */
const FINALIZE_CONCURRENCY = 4;

/** Per-invocation wall-clock budget so a huge room can't blow the function limit. */
const FINALIZE_BUDGET_MS = 40_000;

function mapRoomRow(row: Record<string, unknown>): CbtRoom {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    name: String(row.name ?? ""),
    publicSlug: String(row.public_slug),
    status: (row.status as CbtRoom["status"]) ?? "in_test",
    testId: row.test_id ? String(row.test_id) : null,
    startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    endedAt: row.ended_at ? new Date(row.ended_at as string).toISOString() : null,
    capacity: Number(row.capacity ?? 200),
    rejoinPolicy: row.rejoin_policy === "id_only" ? "id_only" : "name_or_id",
    reportShareEnabled: row.report_share_enabled === true,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

/** Minimal participant stub for a server-side finalization. */
function stubParticipant(row: Record<string, unknown>, roomId: string): CbtParticipant {
  return {
    id: String(row.id),
    roomId,
    displayName: String(row.display_name ?? ""),
    studentCode: String(row.student_code),
    status: "giving_test",
    joinedAt: new Date().toISOString(),
    enteredTestAt: row.entered_test_at ? new Date(row.entered_test_at as string).toISOString() : null,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
    finishedAt: null,
    autoSubmitted: false,
    finalizeReason: null,
    rejoinCount: Number(row.rejoin_count ?? 0),
    lastRejoinAt: null,
    violationCount: Number(row.violation_count ?? 0),
    answeredCount: Number(row.answered_count ?? 0),
    score: null,
    maxScore: null,
    rank: null,
    timeTakenSeconds: null,
  };
}

type PendingRow = Record<string, unknown> & { has_draft?: boolean };

/** Unfinished, un-kicked participants of a room, with "does a draft exist". */
async function loadPendingParticipants(roomId: string): Promise<PendingRow[]> {
  const res = await pool().query(
    `SELECT p.id, p.display_name, p.student_code, p.entered_test_at, p.last_seen_at,
            p.answered_count, p.rejoin_count, p.violation_count,
            EXISTS (
              SELECT 1 FROM cbt.answer_drafts d
               WHERE d.room_id = p.room_id AND d.participant_id = p.id
                 AND d.answers <> '{}'::jsonb
            ) AS has_draft
       FROM cbt.room_participants p
      WHERE p.room_id = $1 AND p.finished_at IS NULL AND p.kicked = FALSE
      ORDER BY p.joined_at ASC`,
    [roomId],
  );
  return res.rows as PendingRow[];
}

/**
 * Finalizes every still-open attempt in a room.
 *
 * `reasonFor` decides per participant — at a deadline it distinguishes a student
 * who was still at the keyboard (`timer`) from one who disappeared and never
 * returned (`expired_offline`, the case that used to be reported as "absent"
 * with no score) from a true no-show (`absent`).
 *
 * Ranks are recomputed once at the end rather than per participant, and the
 * whole pass is bounded so a 200-seat room cannot exhaust the function budget.
 * Everything is idempotent — a partial pass simply resumes on the next call.
 */
async function finalizeRoomParticipants(
  room: CbtRoom,
  reasonFor: (row: PendingRow, now: number) => CbtFinalizeReason,
  opts: { budgetMs?: number } = {},
): Promise<number> {
  const pending = await loadPendingParticipants(room.id);
  if (pending.length === 0) {
    await maybeFinishRoom(room.id);
    return 0;
  }

  const deadline = Date.now() + (opts.budgetMs ?? FINALIZE_BUDGET_MS);
  const queue = [...pending];
  let submitted = 0;

  const worker = async () => {
    for (;;) {
      const row = queue.shift();
      if (!row || Date.now() > deadline) return;
      try {
        const result = await submitAttempt(stubParticipant(row, room.id), room, {
          reason: reasonFor(row, Date.now()),
          violationCount: Number(row.violation_count ?? 0),
          deferRanks: true,
        });
        if (!result.alreadySubmitted) submitted += 1;
      } catch (error) {
        // One bad participant must never stall the rest of the room.
        console.error(`[cbt] finalize failed for participant ${String(row.id)}`, error);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(FINALIZE_CONCURRENCY, queue.length) }, worker));

  await persistRanks(room.id);
  await maybeFinishRoom(room.id);
  return submitted;
}

/** Deadline reason: offline students are the "never came back" case. */
function deadlineReasonFor(row: PendingRow, now: number): CbtFinalizeReason {
  return deriveFinalizeReason({
    enteredTestAt: (row.entered_test_at as string | null) ?? null,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    hasDraft: Boolean(row.has_draft),
    now,
    presenceWindowMs: CBT_PRESENCE_WINDOW_MS,
  });
}

/** Debounce so a busy dashboard doesn't re-scan the same room on every poll. */
const lastLazyFinalize = new Map<string, number>();
const LAZY_FINALIZE_DEBOUNCE_MS = 15_000;

/**
 * Finalizes ONE room if its deadline has passed — the lazy half of the
 * guarantee that nobody is ever left unsubmitted.
 *
 * Called from every teacher/student read path (room view, leaderboard, export,
 * student state), so results are correct the moment anyone looks at them even
 * if the cron is down. Concurrent callers are safe: `submitAttempt` claims each
 * participant row with `SELECT … FOR UPDATE` and bails when `finished_at` is
 * already set.
 *
 * `regrade` (teacher reads only) also retries a few attempts whose grading
 * failed earlier and are due again, inside a small budget. Student reads never
 * pass it: their state poll must not wait on other students' grading (L7); the
 * cron sweep and teacher reads cover those rows.
 *
 * The regrade runs BEFORE, and is not subject to, the per-room debounce: the
 * debounce is shared with every student poll, which refreshes it constantly,
 * so a debounced teacher regrade almost never ran (round-2 review F10). It
 * needs no debounce of its own — it only takes rows that are due
 * (`grading_next_attempt_at`, exponential backoff) and leases what it takes.
 * The finalize scan below stays debounced.
 */
/**
 * The bounded regrade a teacher read runs (room view, leaderboard, export):
 * at most TEACHER_READ_REGRADE_LIMIT rows within TEACHER_READ_REGRADE_BUDGET_MS.
 * Runs for a live room (via finalizeExpiredRoom) AND a finished/closed one,
 * whose pending rows would otherwise wait for the cron sweep. Never throws.
 */
export async function regradeRoomForTeacherRead(roomId: string): Promise<void> {
  try {
    await regradePendingParticipants({
      roomId,
      limit: TEACHER_READ_REGRADE_LIMIT,
      budgetMs: TEACHER_READ_REGRADE_BUDGET_MS,
    });
  } catch (error) {
    console.error(`[cbt] lazy regrade failed for room ${roomId}`, error);
  }
}

export async function finalizeExpiredRoom(
  roomId: string,
  opts: { force?: boolean; regrade?: boolean } = {},
): Promise<number> {
  if (opts.regrade) await regradeRoomForTeacherRead(roomId);

  if (!opts.force) {
    const last = lastLazyFinalize.get(roomId) ?? 0;
    if (Date.now() - last < LAZY_FINALIZE_DEBOUNCE_MS) return 0;
    lastLazyFinalize.set(roomId, Date.now());
  }

  const res = await pool().query(
    `SELECT ${ROOM_SWEEP_COLUMNS}
       FROM cbt.rooms
      WHERE id = $1 AND status = 'in_test' AND started_at IS NOT NULL AND duration_seconds IS NOT NULL
        AND NOW() > started_at + (duration_seconds || ' seconds')::interval
                  + ($2 || ' seconds')::interval`,
    [roomId, String(FINALIZE_GRACE_SECONDS)],
  );
  const row = res.rows[0];
  if (!row) return 0;
  return finalizeRoomParticipants(mapRoomRow(row), deadlineReasonFor);
}

/**
 * Same as finalizeExpiredRoom but never debounced — used by explicit actions.
 * It does not regrade: retries are bounded by `grading_next_attempt_at`, and
 * the teacher's Retry action is the immediate path.
 */
export async function finalizeExpiredRoomNow(roomId: string): Promise<number> {
  return finalizeExpiredRoom(roomId, { force: true });
}

/**
 * Teacher-driven finalization of a live room ("finalize now" / room close).
 * Unlike the deadline path this does not wait for the clock, so every open
 * attempt is graded from its draft with the caller's reason.
 */
export async function finalizeRoomNow(roomId: string, reason: CbtFinalizeReason): Promise<number> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${ROOM_SWEEP_COLUMNS} FROM cbt.rooms WHERE id = $1 AND status = 'in_test'`,
    [roomId],
  );
  const row = res.rows[0];
  if (!row) return 0;
  const room = mapRoomRow(row);
  return finalizeRoomParticipants(room, (pending, now) => {
    // A participant who never opened the paper is still absent, whatever the
    // teacher's reason for ending the room.
    const derived = deadlineReasonFor(pending, now);
    return derived === "absent" ? "absent" : reason;
  });
}

/** Finalizes a single participant on the teacher's instruction. */
export async function finalizeParticipantNow(
  roomId: string,
  participantId: string,
  reason: CbtFinalizeReason = "forced_by_teacher",
): Promise<{ finalized: boolean; alreadySubmitted: boolean }> {
  await ensureCbtSchema();
  const roomRes = await pool().query(`SELECT ${ROOM_SWEEP_COLUMNS} FROM cbt.rooms WHERE id = $1`, [roomId]);
  if (!roomRes.rows[0]) return { finalized: false, alreadySubmitted: false };
  const room = mapRoomRow(roomRes.rows[0]);

  const pending = (await loadPendingParticipants(roomId)).find((row) => String(row.id) === participantId);
  if (!pending) return { finalized: false, alreadySubmitted: true };

  const derived = deadlineReasonFor(pending, Date.now());
  const result = await submitAttempt(stubParticipant(pending, roomId), room, {
    reason: derived === "absent" ? "absent" : reason,
    violationCount: Number(pending.violation_count ?? 0),
  });
  return { finalized: !result.alreadySubmitted, alreadySubmitted: result.alreadySubmitted };
}

// ── Drain / sweep ──────────────────────────────────────────────────────────────

/**
 * Auto-submits participants in rooms whose time is up (started_at + duration +
 * 10s grace), then finishes those rooms. Unattended backstop for the client
 * auto-submit and for the lazy finalize-on-read above.
 */
export async function sweepExpiredCbtRooms(
  limit = 20,
): Promise<{ roomsSwept: number; participantsSubmitted: number; participantsRegraded: number }> {
  await ensureCbtSchema();
  const rooms = await pool().query(
    `SELECT ${ROOM_SWEEP_COLUMNS}
       FROM cbt.rooms
      WHERE status = 'in_test' AND started_at IS NOT NULL AND duration_seconds IS NOT NULL
        AND NOW() > started_at + (duration_seconds || ' seconds')::interval
                  + ($2 || ' seconds')::interval
      ORDER BY started_at ASC
      LIMIT $1`,
    [limit, String(FINALIZE_GRACE_SECONDS)],
  );

  const budgetPerRoom = Math.max(5_000, Math.floor(FINALIZE_BUDGET_MS / Math.max(1, rooms.rows.length)));
  let participantsSubmitted = 0;
  for (const roomRow of rooms.rows) {
    const room = mapRoomRow(roomRow);
    try {
      participantsSubmitted += await finalizeRoomParticipants(room, deadlineReasonFor, {
        budgetMs: budgetPerRoom,
      });
    } catch (error) {
      // One bad room must not stall the sweep; the next tick retries it.
      console.error(`[cbt] sweep failed for room ${room.id}`, error);
    }
  }

  // Attempts claimed but never graded (grader/DB error after the claim) — in
  // ANY room status, since the room may have finished meanwhile.
  let participantsRegraded = 0;
  try {
    participantsRegraded = (await regradePendingParticipants()).regraded;
  } catch (error) {
    console.error("[cbt] regrade sweep failed", error);
  }
  return { roomsSwept: rooms.rows.length, participantsSubmitted, participantsRegraded };
}

/**
 * Re-grades attempts whose grading is still owed (`grading_status = 'pending'`)
 * — the retry half of "never lose an attempt when grading fails". Each failure
 * bumps `grading_attempts` and pushes `grading_next_attempt_at` out per
 * GRADING_RETRY_BACKOFF_SECONDS; at GRADING_MAX_ATTEMPTS the row is parked as
 * 'failed' and only a teacher retry brings it back. Only rows that are due are
 * taken, rows claimed in the last REGRADE_MIN_AGE_SECONDS are skipped so an
 * in-flight first pass is not raced, and every taken row is leased
 * (GRADING_LEASE_SECONDS, `FOR UPDATE SKIP LOCKED`) so two instances never
 * spend two tries on it at once. Ranks are re-persisted once per room that
 * gained a score.
 */
export async function regradePendingParticipants(
  opts: { limit?: number; roomId?: string; budgetMs?: number } = {},
): Promise<{ regraded: number; failed: number }> {
  const limit = Math.max(1, Math.min(200, Math.floor(opts.limit ?? 50)));
  const res = await pool().query(
    `UPDATE cbt.room_participants p
        SET grading_next_attempt_at = NOW() + ($4 || ' seconds')::interval
      WHERE p.id IN (
              SELECT d.id
                FROM cbt.room_participants d
               WHERE d.grading_status = 'pending'
                 AND d.finished_at < NOW() - ($2 || ' seconds')::interval
                 AND (d.grading_next_attempt_at IS NULL OR d.grading_next_attempt_at <= NOW())
                 AND ($3::text IS NULL OR d.room_id = $3)
               ORDER BY d.finished_at ASC
               LIMIT $1
                 FOR UPDATE SKIP LOCKED
            )
        AND p.grading_status = 'pending'
    RETURNING p.id, p.room_id, p.student_code, p.finished_at`,
    [limit, String(REGRADE_MIN_AGE_SECONDS), opts.roomId ?? null, String(GRADING_LEASE_SECONDS)],
  );
  if (res.rows.length === 0) return { regraded: 0, failed: 0 };
  // RETURNING has no order; grade the oldest claim first.
  res.rows.sort((a, b) => new Date(a.finished_at as string).getTime() - new Date(b.finished_at as string).getTime());

  const roomIds = [...new Set(res.rows.map((row) => String(row.room_id)))];
  const roomRes = await pool().query(`SELECT ${ROOM_SWEEP_COLUMNS} FROM cbt.rooms WHERE id = ANY($1::text[])`, [
    roomIds,
  ]);
  const rooms = new Map(roomRes.rows.map((row) => [String(row.id), mapRoomRow(row)]));

  const deadline = Date.now() + (opts.budgetMs ?? FINALIZE_BUDGET_MS);
  const touchedRooms = new Set<string>();
  const unprocessed = new Set(res.rows.map((row) => String(row.id)));
  let regraded = 0;
  let failed = 0;
  for (const row of res.rows) {
    if (Date.now() > deadline) break;
    unprocessed.delete(String(row.id));
    const room = rooms.get(String(row.room_id));
    if (!room) continue; // room deleted; its participants cascade away
    const participant = { id: String(row.id), studentCode: String(row.student_code) };
    const outcome = await gradeOrRecordFailure(room, participant);
    if (outcome.ok) {
      regraded += 1;
      touchedRooms.add(room.id);
      await publishRoomEvent(room.id, {
        type: "participant_finished",
        participant_id: participant.id,
        student_code: participant.studentCode,
      });
    } else {
      failed += 1;
    }
  }
  for (const roomId of touchedRooms) await persistRanks(roomId);
  if (unprocessed.size > 0) {
    // Out of budget: hand the untried leases back so these rows stay due.
    await pool()
      .query(
        `UPDATE cbt.room_participants SET grading_next_attempt_at = NULL
          WHERE id = ANY($1::text[]) AND grading_status = 'pending'`,
        [[...unprocessed]],
      )
      .catch((error) => console.error("[cbt] could not release regrade leases", error));
  }
  return { regraded, failed };
}

/**
 * Teacher "retry grading" for an attempt parked as 'failed', or stuck in
 * 'pending' for over STUCK_PENDING_GRADING_SECONDS (M7): resets the retry
 * budget and the backoff (L7: it never waits for `grading_next_attempt_at`)
 * and grades it right away, holding a lease so the sweep does not race it. A new failure leaves it 'pending' for the
 * sweep (with a fresh GRADING_MAX_ATTEMPTS budget). A fresh 'pending' row (a
 * first pass may still be running) is left alone and reported as is.
 */
export async function retryParticipantGrading(
  roomId: string,
  participantId: string,
): Promise<{ found: boolean; gradingStatus: CbtGradingStatus | null; score?: number; maxScore?: number }> {
  await ensureCbtSchema();
  const reset = await pool().query(
    `UPDATE cbt.room_participants
        SET grading_status = 'pending', grading_attempts = 0, grading_error = NULL,
            grading_next_attempt_at = NOW() + ($3 || ' seconds')::interval
      WHERE id = $1 AND room_id = $2 AND finished_at IS NOT NULL AND ${TEACHER_RETRYABLE_GRADING_SQL}
      RETURNING student_code`,
    [participantId, roomId, String(GRADING_LEASE_SECONDS)],
  );
  if (!reset.rows[0]) {
    const current = await pool().query(
      `SELECT grading_status FROM cbt.room_participants WHERE id = $1 AND room_id = $2`,
      [participantId, roomId],
    );
    if (!current.rows[0]) return { found: false, gradingStatus: null };
    return { found: true, gradingStatus: toGradingStatus(current.rows[0].grading_status) };
  }
  const roomRes = await pool().query(`SELECT ${ROOM_SWEEP_COLUMNS} FROM cbt.rooms WHERE id = $1`, [roomId]);
  if (!roomRes.rows[0]) return { found: false, gradingStatus: null };
  const room = mapRoomRow(roomRes.rows[0]);
  const participant = { id: participantId, studentCode: String(reset.rows[0].student_code) };
  const outcome = await gradeOrRecordFailure(room, participant);
  if (!outcome.ok) return { found: true, gradingStatus: outcome.gradingStatus };
  await persistRanks(room.id);
  await publishRoomEvent(room.id, {
    type: "participant_finished",
    participant_id: participant.id,
    student_code: participant.studentCode,
  });
  return { found: true, gradingStatus: "done", score: outcome.score, maxScore: outcome.maxScore };
}

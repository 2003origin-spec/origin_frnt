/**
 * CBT test-run: sanitized delivery, autosave drafts, and server-authoritative
 * grading. Students never receive answers/explanations; grading always runs from
 * the server-held draft (never client-reported scores). Uses the shared grader
 * service when configured, with a deterministic local fallback.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  gradeAssessmentBatchWithService,
  type AssessmentBatchGradeItem,
  type GraderScoringPolicy,
} from "@/server/grader-client";
import type { StoredQuestion, StoredUserAnswer } from "@/server/store";
import type { CbtParticipant, CbtRoom } from "@/lib/cbt/room-model";
import type { CbtQuestionAnswer, CbtQuestionType } from "@/lib/cbt/question-model";
import {
  isAnswered,
  type CbtPaletteStatus,
  type CbtSanitizedQuestion,
  type CbtStudentAnswer,
  type CbtTestPayload,
} from "@/lib/cbt/attempt-model";

import { shuffleQuestionsForParticipant } from "@/lib/cbt/shuffle";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtError, publishPresence, publishRoomEvent } from "./cbt-rooms-service";
import { readShuffleQuestions } from "./cbt-tests-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type TestQuestionRow = {
  position: number;
  questionId: string;
  questionType: CbtQuestionType;
  stem: string;
  image: string | null;
  options: { text: string }[];
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
    image: typeof row.image === "string" && row.image.trim() ? String(row.image).trim() : null,
    options: Array.isArray(row.options) ? (row.options as { text: string }[]) : [],
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
    options: q.options.map((o) => String(o?.text ?? "")),
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
  if (room.status !== "in_test") throw cbtError(409, "The test has not started.");
  if (participant.finishedAt) throw cbtError(409, "You have already submitted.");
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

/** Draft answers + palette for resume hydration (student's own only). */
export async function loadDraft(
  roomId: string,
  participantId: string,
): Promise<{ answers: Record<number, CbtStudentAnswer>; palette: Record<number, CbtPaletteStatus> }> {
  const res = await pool().query(
    `SELECT answers, palette FROM cbt.answer_drafts WHERE room_id = $1 AND participant_id = $2`,
    [roomId, participantId],
  );
  const row = res.rows[0];
  return {
    answers: (row?.answers ?? {}) as Record<number, CbtStudentAnswer>,
    palette: (row?.palette ?? {}) as Record<number, CbtPaletteStatus>,
  };
}

// ── Autosave ─────────────────────────────────────────────────────────────────

const lastPresencePublish = new Map<string, number>();

function countAnswered(answers: Record<number, CbtStudentAnswer>): number {
  return Object.values(answers).filter((a) => isAnswered(a)).length;
}

export async function saveAnswers(
  participant: CbtParticipant,
  room: CbtRoom,
  answers: Record<number, CbtStudentAnswer>,
  palette: Record<number, CbtPaletteStatus>,
): Promise<{ answeredCount: number }> {
  if (room.status !== "in_test") throw cbtError(409, "The test is not active.");
  if (participant.finishedAt) throw cbtError(409, "You have already submitted.");

  // Cap the draft payload (~64KB each) so a malicious client can't bloat the row.
  const answersJson = JSON.stringify(answers ?? {});
  const paletteJson = JSON.stringify(palette ?? {});
  if (answersJson.length > 64 * 1024 || paletteJson.length > 64 * 1024) {
    throw cbtError(413, "Answer payload too large.");
  }

  const answeredCount = countAnswered(answers);
  await pool().query(
    `INSERT INTO cbt.answer_drafts (room_id, participant_id, answers, palette, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
     ON CONFLICT (room_id, participant_id)
       DO UPDATE SET answers = EXCLUDED.answers, palette = EXCLUDED.palette, updated_at = NOW()`,
    [room.id, participant.id, answersJson, paletteJson],
  );
  await pool().query(
    `UPDATE cbt.room_participants SET answered_count = $3, last_seen_at = NOW(),
            entered_test_at = COALESCE(entered_test_at, NOW())
       WHERE id = $1 AND room_id = $2`,
    [participant.id, room.id, answeredCount],
  );

  // Coalesced presence re-publish (≥5s) so the teacher's progress column moves
  // without a publish per keystroke.
  const now = Date.now();
  if (now - (lastPresencePublish.get(room.id) ?? 0) >= 5000) {
    lastPresencePublish.set(room.id, now);
    await publishPresence(room.id, room.status);
  }
  return { answeredCount };
}

// ── Grading ──────────────────────────────────────────────────────────────────

type GradeOutcome = { marksAwarded: number; isCorrect: boolean; needsReview: boolean };

function firstNumber(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  const match = text.replace(/,/g, "").match(/-?\d+(\.\d+)?([eE]-?\d+)?/);
  return match ? Number(match[0]) : null;
}

function normalizeExpr(text: string | null | undefined): string {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "").replace(/\*/g, "");
}

function scoreObjective(correct: boolean, answered: boolean, marks: number, negativeMarks: number): number {
  if (correct) return marks;
  if (answered) return negativeMarks;
  return 0;
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
      const expected = firstNumber(answer.answerText);
      const submitted = firstNumber(student.answerText);
      const tolerance = answer.tolerance ?? Math.max(Math.abs(expected ?? 0) * 0.01, 0.001);
      const correct =
        expected !== null && submitted !== null && Math.abs(submitted - expected) <= tolerance;
      return { marksAwarded: scoreObjective(correct, answered, marks, negativeMarks), isCorrect: correct, needsReview: false };
    }
    case "matrix_match": {
      const expected = [...((answer.matrixData?.correct_pairs as number[][]) ?? [])].map((p) => p.join(":")).sort();
      const submitted = [...(student.matrixPairs ?? [])].map((p) => p.join(":")).sort();
      const correct = expected.length > 0 && JSON.stringify(expected) === JSON.stringify(submitted);
      const set = new Set(expected);
      const matched = submitted.filter((p) => set.has(p)).length;
      const credit = correct ? 1 : expected.length > 0 ? matched / expected.length : 0;
      const marksAwarded = credit > 0 ? Number((credit * marks).toFixed(3)) : answered ? negativeMarks : 0;
      return { marksAwarded, isCorrect: correct, needsReview: false };
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

async function gradeAll(
  roomId: string,
  participantId: string,
  questions: TestQuestionRow[],
  answers: Record<number, CbtStudentAnswer>,
): Promise<{ position: number; outcome: GradeOutcome }[]> {
  // Try the remote grader for the whole batch; fall back locally on null.
  let remote: Awaited<ReturnType<typeof gradeAssessmentBatchWithService>> = null;
  try {
    const items: AssessmentBatchGradeItem[] = questions.map((q) => {
      const scoringPolicy: GraderScoringPolicy = {
        correctMarks: q.marks,
        incorrectMarks: q.negativeMarks,
        unattemptedMarks: 0,
        partialCreditPolicy: "fractional",
        negativeMarkingMode: "answered_only",
      };
      return {
        question: toStoredQuestion(q),
        answer: toStoredAnswer(answers[q.position] ?? {}),
        attemptRef: String(q.position),
        scoringPolicy,
      };
    });
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

export async function submitAttempt(
  participant: CbtParticipant,
  room: CbtRoom,
  opts: { auto?: boolean } = {},
): Promise<{ alreadySubmitted: boolean; score?: number; maxScore?: number }> {
  await ensureCbtSchema();
  if (!room.testId) throw cbtError(409, "This room has no test.");

  // Idempotency guard: lock the participant row and bail if already finished.
  const client = await pool().connect();
  let shouldGrade = false;
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT finished_at FROM cbt.room_participants WHERE id = $1 AND room_id = $2 FOR UPDATE`,
      [participant.id, room.id],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      throw cbtError(404, "Participant not found.");
    }
    if (locked.rows[0].finished_at) {
      await client.query("ROLLBACK");
      return { alreadySubmitted: true };
    }
    // Claim the submission immediately so a concurrent auto+manual can't double-grade.
    await client.query(
      `UPDATE cbt.room_participants SET finished_at = NOW(), auto_submitted = $3 WHERE id = $1 AND room_id = $2`,
      [participant.id, room.id, Boolean(opts.auto)],
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

  // Grade from the server-held draft.
  const draftRes = await pool().query(
    `SELECT answers FROM cbt.answer_drafts WHERE room_id = $1 AND participant_id = $2`,
    [room.id, participant.id],
  );
  const answers = (draftRes.rows[0]?.answers ?? {}) as Record<number, CbtStudentAnswer>;
  const questions = await loadTestQuestions(room.testId);
  const grades = await gradeAll(room.id, participant.id, questions, answers);

  let score = 0;
  const maxScore = questions.reduce((sum, q) => sum + q.marks, 0);
  const qByPos = new Map(questions.map((q) => [q.position, q]));

  for (const { position, outcome } of grades) {
    score += outcome.marksAwarded;
    const q = qByPos.get(position)!;
    await pool().query(
      `INSERT INTO cbt.submission_answers
         (room_id, participant_id, position, question_snapshot, submitted_answer, grading_result, marks_awarded)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)
       ON CONFLICT (room_id, participant_id, position) DO UPDATE
         SET submitted_answer = EXCLUDED.submitted_answer,
             grading_result = EXCLUDED.grading_result,
             marks_awarded = EXCLUDED.marks_awarded`,
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
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          subject: q.subject,
        }),
        JSON.stringify(answers[position] ?? {}),
        JSON.stringify({ isCorrect: outcome.isCorrect, needsReview: outcome.needsReview }),
        Number(outcome.marksAwarded.toFixed(3)),
      ],
    );
  }

  const startedMs = room.startedAt ? new Date(room.startedAt).getTime() : Date.now();
  const cap = room.durationSeconds ?? Number.MAX_SAFE_INTEGER;
  const timeTaken = Math.max(0, Math.min(cap, Math.round((Date.now() - startedMs) / 1000)));
  const answeredCount = countAnswered(answers);

  await pool().query(
    `UPDATE cbt.room_participants
        SET score = $3, max_score = $4, answered_count = $5, time_taken_seconds = $6, last_seen_at = NOW()
      WHERE id = $1 AND room_id = $2`,
    [participant.id, room.id, Number(score.toFixed(3)), Number(maxScore.toFixed(3)), answeredCount, timeTaken],
  );

  await persistRanks(room.id);
  await publishRoomEvent(room.id, {
    type: "participant_finished",
    participant_id: participant.id,
    student_code: participant.studentCode,
  });

  await maybeFinishRoom(room.id);

  return { alreadySubmitted: false, score: Number(score.toFixed(3)), maxScore: Number(maxScore.toFixed(3)) };
}

/** Finishes the room + broadcasts test_ended once every active participant is done. */
async function maybeFinishRoom(roomId: string): Promise<void> {
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

// ── Drain / sweep ──────────────────────────────────────────────────────────────

/**
 * Auto-submits participants in rooms whose time is up (started_at + duration +
 * 10s grace), then finishes those rooms. Backstop for the client auto-submit.
 */
export async function sweepExpiredCbtRooms(limit = 20): Promise<{ roomsSwept: number; participantsSubmitted: number }> {
  await ensureCbtSchema();
  const rooms = await pool().query(
    `SELECT id, teacher_id, name, public_slug, status, test_id, started_at, duration_seconds, ended_at,
            capacity, created_at, updated_at
       FROM cbt.rooms
      WHERE status = 'in_test' AND started_at IS NOT NULL AND duration_seconds IS NOT NULL
        AND NOW() > started_at + (duration_seconds || ' seconds')::interval + INTERVAL '10 seconds'
      ORDER BY started_at ASC
      LIMIT $1`,
    [limit],
  );

  let participantsSubmitted = 0;
  for (const roomRow of rooms.rows) {
    const room = mapRoomRow(roomRow);
    const parts = await pool().query(
      `SELECT id, student_code, token_version FROM cbt.room_participants
        WHERE room_id = $1 AND finished_at IS NULL AND kicked = FALSE`,
      [room.id],
    );
    for (const p of parts.rows) {
      try {
        const stub: CbtParticipant = {
          id: String(p.id),
          roomId: room.id,
          displayName: "",
          studentCode: String(p.student_code),
          status: "giving_test",
          joinedAt: new Date().toISOString(),
          enteredTestAt: null,
          lastSeenAt: null,
          finishedAt: null,
          autoSubmitted: false,
          answeredCount: 0,
          score: null,
          maxScore: null,
          rank: null,
          timeTakenSeconds: null,
        };
        const result = await submitAttempt(stub, room, { auto: true });
        if (!result.alreadySubmitted) participantsSubmitted += 1;
      } catch {
        // one bad participant must not stall the sweep
      }
    }
    // submitAttempt→maybeFinishRoom finishes the room once all are done; ensure it.
    await maybeFinishRoom(room.id);
  }
  return { roomsSwept: rooms.rows.length, participantsSubmitted };
}

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
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

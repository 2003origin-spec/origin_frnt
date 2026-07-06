/**
 * Teacher-only CBT analytics: authoritative leaderboard + per-participant
 * per-question drill-down. Every read is scoped by the room's teacher_id — a
 * participant token can never reach any of this.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import type { CbtParticipantStatus } from "@/lib/cbt/events";
import type { CbtRoomStatus } from "@/lib/cbt/room-model";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtError } from "./cbt-rooms-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const PRESENCE_WINDOW_MS = 45_000;

function deriveStatus(
  row: { last_seen_at: unknown; entered_test_at: unknown; finished_at: unknown },
  roomStatus: CbtRoomStatus,
  now: number,
): CbtParticipantStatus {
  if (row.finished_at) return "submitted";
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at as string).getTime() : 0;
  if (now - lastSeen > PRESENCE_WINDOW_MS) return "offline";
  if (roomStatus === "in_test" && row.entered_test_at) return "giving_test";
  return "in_lobby";
}

export type CbtLeaderboardRow = {
  participantId: string;
  displayName: string;
  studentCode: string;
  status: CbtParticipantStatus;
  answeredCount: number;
  score: number | null;
  maxScore: number | null;
  rank: number | null;
  timeTakenSeconds: number | null;
  finishedAt: string | null;
  autoSubmitted: boolean;
};

export type CbtLeaderboard = {
  roomStatus: CbtRoomStatus;
  totalQuestions: number;
  maxScore: number;
  participants: CbtLeaderboardRow[];
};

export async function getRoomLeaderboard(teacherId: string, roomId: string): Promise<CbtLeaderboard | null> {
  await ensureCbtSchema();
  const roomRes = await pool().query(
    `SELECT status, test_id FROM cbt.rooms WHERE id = $1 AND teacher_id = $2`,
    [roomId, teacherId],
  );
  const room = roomRes.rows[0];
  if (!room) return null;

  let totalQuestions = 0;
  let maxScore = 0;
  if (room.test_id) {
    const meta = await pool().query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(marks), 0)::float8 AS max_score
         FROM cbt.test_questions WHERE test_id = $1`,
      [room.test_id],
    );
    totalQuestions = Number(meta.rows[0]?.n ?? 0);
    maxScore = Number(meta.rows[0]?.max_score ?? 0);
  }

  const parts = await pool().query(
    `SELECT id, display_name, student_code, answered_count, score, max_score, rank,
            time_taken_seconds, finished_at, auto_submitted, last_seen_at, entered_test_at
       FROM cbt.room_participants
      WHERE room_id = $1
      ORDER BY (finished_at IS NULL), rank ASC NULLS LAST, score DESC NULLS LAST,
               answered_count DESC, joined_at ASC`,
    [roomId],
  );
  const now = Date.now();
  const roomStatus = (room.status as CbtRoomStatus) ?? "lobby";

  return {
    roomStatus,
    totalQuestions,
    maxScore: Number(maxScore.toFixed(3)),
    participants: parts.rows.map((r) => ({
      participantId: String(r.id),
      displayName: String(r.display_name ?? ""),
      studentCode: String(r.student_code),
      status: deriveStatus(r as never, roomStatus, now),
      answeredCount: Number(r.answered_count ?? 0),
      score: r.score != null ? Number(r.score) : null,
      maxScore: r.max_score != null ? Number(r.max_score) : null,
      rank: r.rank != null ? Number(r.rank) : null,
      timeTakenSeconds: r.time_taken_seconds != null ? Number(r.time_taken_seconds) : null,
      finishedAt: r.finished_at ? new Date(r.finished_at as string).toISOString() : null,
      autoSubmitted: Boolean(r.auto_submitted),
    })),
  };
}

export type CbtDrilldownQuestion = {
  position: number;
  questionType: string;
  stem: string;
  subject: string | null;
  marks: number;
  marksAwarded: number;
  isCorrect: boolean;
  needsReview: boolean;
  attempted: boolean;
};

export type CbtParticipantDrilldown = {
  participant: {
    participantId: string;
    displayName: string;
    studentCode: string;
    score: number | null;
    maxScore: number | null;
    rank: number | null;
    timeTakenSeconds: number | null;
    finishedAt: string | null;
    autoSubmitted: boolean;
  };
  summary: { correct: number; wrong: number; unattempted: number; needsReview: number };
  questions: CbtDrilldownQuestion[];
};

export async function getParticipantDrilldown(
  teacherId: string,
  roomId: string,
  participantId: string,
): Promise<CbtParticipantDrilldown | null> {
  await ensureCbtSchema();
  const ownRes = await pool().query(`SELECT id FROM cbt.rooms WHERE id = $1 AND teacher_id = $2`, [roomId, teacherId]);
  if (!ownRes.rows[0]) return null;

  const pRes = await pool().query(
    `SELECT id, display_name, student_code, score, max_score, rank, time_taken_seconds,
            finished_at, auto_submitted
       FROM cbt.room_participants WHERE id = $1 AND room_id = $2`,
    [participantId, roomId],
  );
  const p = pRes.rows[0];
  if (!p) return null;

  const aRes = await pool().query(
    `SELECT position, question_snapshot, submitted_answer, grading_result, marks_awarded
       FROM cbt.submission_answers WHERE room_id = $1 AND participant_id = $2 ORDER BY position ASC`,
    [roomId, participantId],
  );

  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  let needsReview = 0;
  const questions: CbtDrilldownQuestion[] = aRes.rows.map((r) => {
    const snap = (r.question_snapshot ?? {}) as {
      questionType?: string;
      stem?: string;
      subject?: string | null;
      marks?: number;
    };
    const grading = (r.grading_result ?? {}) as { isCorrect?: boolean; needsReview?: boolean };
    const submitted = (r.submitted_answer ?? {}) as Record<string, unknown>;
    const attempted = Object.keys(submitted).length > 0 && hasAnswerValue(submitted);
    const isCorrect = Boolean(grading.isCorrect);
    const review = Boolean(grading.needsReview);

    if (review) needsReview += 1;
    if (!attempted) unattempted += 1;
    else if (isCorrect) correct += 1;
    else wrong += 1;

    return {
      position: Number(r.position),
      questionType: String(snap.questionType ?? "mcq"),
      stem: String(snap.stem ?? ""),
      subject: snap.subject ?? null,
      marks: Number(snap.marks ?? 0),
      marksAwarded: Number(r.marks_awarded ?? 0),
      isCorrect,
      needsReview: review,
      attempted,
    };
  });

  return {
    participant: {
      participantId: String(p.id),
      displayName: String(p.display_name ?? ""),
      studentCode: String(p.student_code),
      score: p.score != null ? Number(p.score) : null,
      maxScore: p.max_score != null ? Number(p.max_score) : null,
      rank: p.rank != null ? Number(p.rank) : null,
      timeTakenSeconds: p.time_taken_seconds != null ? Number(p.time_taken_seconds) : null,
      finishedAt: p.finished_at ? new Date(p.finished_at as string).toISOString() : null,
      autoSubmitted: Boolean(p.auto_submitted),
    },
    summary: { correct, wrong, unattempted, needsReview },
    questions,
  };
}

function hasAnswerValue(a: Record<string, unknown>): boolean {
  const text = a.answerText;
  if (typeof text === "string" && text.trim() !== "") return true;
  if (typeof a.selectedOption === "number") return true;
  if (Array.isArray(a.selectedOptions) && a.selectedOptions.length > 0) return true;
  if (Array.isArray(a.matrixPairs) && a.matrixPairs.length > 0) return true;
  return false;
}

export { cbtError };

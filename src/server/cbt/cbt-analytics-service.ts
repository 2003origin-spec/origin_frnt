/**
 * Teacher-only CBT analytics: authoritative leaderboard + per-participant
 * per-question drill-down. Every read is scoped by the room's teacher_id — a
 * participant token can never reach any of this.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import type { CbtParticipantStatus } from "@/lib/cbt/events";
import type { CbtRoomStatus } from "@/lib/cbt/room-model";
import { CBT_PRESENCE_WINDOW_MS, isCbtFinalizeReason, type CbtFinalizeReason } from "@/lib/cbt/finalize-reason";
import {
  canonicalSubjectLabel,
  orderedSections,
  type CbtSectionScore,
  type CbtSectionScores,
} from "@/lib/cbt/sections";

import { ensureCbtSchema } from "./cbt-schema";
import { loadSectionScores } from "./cbt-sections-service";
import { cbtError, finalizeIfExpired } from "./cbt-rooms-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const PRESENCE_WINDOW_MS = CBT_PRESENCE_WINDOW_MS;

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
  /** Why the attempt ended — drives the "went offline" badge and the export. */
  finalizeReason: CbtFinalizeReason | null;
  /** How long since the last heartbeat, for the "offline for 12m" column. */
  offlineForSeconds: number | null;
  rejoinCount: number;
  violationCount: number;
  /** Per-subject breakdown, empty for an in-flight or absent attempt. */
  sectionScores: CbtSectionScores;
};

/** A section column header for the leaderboard table, in paper order. */
export type CbtLeaderboardSection = { key: string; label: string; maxScore: number };

export type CbtLeaderboard = {
  roomStatus: CbtRoomStatus;
  totalQuestions: number;
  maxScore: number;
  /** Empty when the paper has a single section (the total already says it). */
  sections: CbtLeaderboardSection[];
  participants: CbtLeaderboardRow[];
};

export async function getRoomLeaderboard(teacherId: string, roomId: string): Promise<CbtLeaderboard | null> {
  await ensureCbtSchema();
  let roomRes = await pool().query(
    `SELECT id, status, test_id FROM cbt.rooms WHERE id = $1 AND teacher_id = $2`,
    [roomId, teacherId],
  );
  if (!roomRes.rows[0]) return null;

  // Reading results past the deadline finalizes the room first, so a student
  // whose browser died is scored from their draft instead of showing as absent.
  if (await finalizeIfExpired({ id: roomId, status: roomRes.rows[0].status as CbtRoomStatus })) {
    roomRes = await pool().query(`SELECT id, status, test_id FROM cbt.rooms WHERE id = $1 AND teacher_id = $2`, [
      roomId,
      teacherId,
    ]);
  }
  const room = roomRes.rows[0];
  if (!room) return null;

  let totalQuestions = 0;
  let maxScore = 0;
  // Section headers come from the TEST, not from any one attempt, so the table
  // has the same columns for a student who was marked absent as for one who
  // sat the whole paper.
  let sections: CbtLeaderboardSection[] = [];
  if (room.test_id) {
    const meta = await pool().query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(marks), 0)::float8 AS max_score
         FROM cbt.test_questions WHERE test_id = $1`,
      [room.test_id],
    );
    totalQuestions = Number(meta.rows[0]?.n ?? 0);
    maxScore = Number(meta.rows[0]?.max_score ?? 0);
    sections = await loadTestSections(room.test_id);
  }

  const parts = await pool().query(
    `SELECT id, display_name, student_code, answered_count, score, max_score, rank,
            time_taken_seconds, finished_at, auto_submitted, last_seen_at, entered_test_at,
            finalize_reason, rejoin_count, violation_count, section_scores
       FROM cbt.room_participants
      WHERE room_id = $1
      ORDER BY (finished_at IS NULL), rank ASC NULLS LAST, score DESC NULLS LAST,
               answered_count DESC, joined_at ASC`,
    [roomId],
  );
  const now = Date.now();
  const roomStatus = (room.status as CbtRoomStatus) ?? "lobby";

  // Attempts graded before 2026-08-04 carry no section_scores; they are derived
  // from their submissions and healed in place on this read.
  const sectionsByParticipant = await loadSectionScores(
    roomId,
    parts.rows.map((r) => ({
      id: String(r.id),
      sectionScores: r.section_scores,
      finished: Boolean(r.finished_at),
    })),
  );

  return {
    roomStatus,
    totalQuestions,
    maxScore: Number(maxScore.toFixed(3)),
    sections,
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
      finalizeReason: isCbtFinalizeReason(r.finalize_reason) ? r.finalize_reason : null,
      offlineForSeconds: offlineSecondsOf(r.last_seen_at, r.finished_at, now),
      rejoinCount: Number(r.rejoin_count ?? 0),
      violationCount: Number(r.violation_count ?? 0),
      sectionScores: sectionsByParticipant[String(r.id)] ?? {},
    })),
  };
}

/**
 * The paper's subject sections with their maximum marks, in paper order.
 *
 * Returns `[]` for a single-section paper: "Physics 72/80" printed directly
 * above "Total 72/80" reads like a rendering bug, so the UI shows only the
 * total in that case.
 */
export async function loadTestSections(testId: string): Promise<CbtLeaderboardSection[]> {
  const res = await pool().query(
    `SELECT COALESCE(NULLIF(btrim(lower(q.subject)), ''), 'general') AS section_key,
            (array_agg(q.subject ORDER BY tq.position))[1]           AS label,
            MIN(tq.position)                                         AS order_pos,
            COALESCE(SUM(tq.marks), 0)::float8                       AS max_score
       FROM cbt.test_questions tq
       JOIN cbt.questions q ON q.id = tq.question_id
      WHERE tq.test_id = $1
      GROUP BY section_key
      ORDER BY order_pos ASC`,
    [testId],
  );
  if (res.rows.length <= 1) return [];
  return res.rows.map((r) => {
    const key = String(r.section_key);
    return {
      key,
      label: canonicalSubjectLabel(typeof r.label === "string" && r.label.trim() ? r.label : key),
      maxScore: Number(Number(r.max_score ?? 0).toFixed(3)),
    };
  });
}

/** Seconds since the last heartbeat for a still-running attempt (else null). */
function offlineSecondsOf(lastSeenAt: unknown, finishedAt: unknown, now: number): number | null {
  if (finishedAt || !lastSeenAt) return null;
  const seen = new Date(lastSeenAt as string).getTime();
  if (!Number.isFinite(seen)) return null;
  const elapsed = Math.floor((now - seen) / 1000);
  return elapsed * 1000 > PRESENCE_WINDOW_MS ? elapsed : null;
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
  /** Advisory seconds; 0 for attempts finished before timing shipped. */
  timeSpentSeconds: number;
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
  /** Per-subject marks, in paper order. Empty for a single-section paper. */
  sections: CbtSectionScore[];
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
            finished_at, auto_submitted, section_scores
       FROM cbt.room_participants WHERE id = $1 AND room_id = $2`,
    [participantId, roomId],
  );
  const p = pRes.rows[0];
  if (!p) return null;

  const aRes = await pool().query(
    `SELECT position, question_snapshot, submitted_answer, grading_result, marks_awarded,
            time_spent_seconds
       FROM cbt.submission_answers WHERE room_id = $1 AND participant_id = $2 ORDER BY position ASC`,
    [roomId, participantId],
  );

  const sectionMap = await loadSectionScores(roomId, [
    { id: participantId, sectionScores: p.section_scores, finished: Boolean(p.finished_at) },
  ]);
  const sections = orderedSections(sectionMap[participantId]);

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
      timeSpentSeconds: Number(r.time_spent_seconds ?? 0),
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
    // A one-section paper repeats the total, so it is suppressed here too.
    sections: sections.length > 1 ? sections : [],
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

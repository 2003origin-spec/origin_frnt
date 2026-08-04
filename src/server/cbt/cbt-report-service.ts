/**
 * The CBT participant report card — the payload behind the shareable link.
 *
 * This is the ONLY path that releases a CBT answer key, so the gate is strict
 * and re-evaluated on every request (nothing about it is cached):
 *
 *   1. the platform kill switch  (`cbtReportCards`)
 *   2. the teacher's premium add-on (`cbt.teachers.report_cards_enabled`,
 *      admin-controlled, FALSE by default)
 *   3. the teacher's per-room publish switch (`cbt.rooms.report_share_enabled`)
 *   4. the room is finished/closed — never while an attempt is live
 *   5. the participant's own attempt is finished AND graded
 *
 * Failing 1–3 is indistinguishable from "no such room" to an unauthenticated
 * caller, so the endpoint cannot be used to confirm that a room exists.
 *
 * Everything the report shows is read from `cbt.submission_answers`, which
 * snapshots the question (stem, options, correct answer, explanation, marks,
 * subject) at grading time — so a report never drifts if the teacher later
 * edits the question, and no join into live question rows is needed.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isCbtFinalizeReason, isGradedReason, type CbtFinalizeReason } from "@/lib/cbt/finalize-reason";
import { orderedSections, type CbtSectionScore } from "@/lib/cbt/sections";
import { normalizeStudentCode } from "@/lib/cbt/student-code";
import type { CbtQuestionType } from "@/lib/cbt/question-model";

import { ensureCbtSchema } from "./cbt-schema";
import { loadSectionScores } from "./cbt-sections-service";
import { finalizeExpiredRoom } from "./cbt-attempts-service";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Why a report could not be produced. Mapped to status codes by the route. */
export type CbtReportDenial =
  | "not_found" // feature off, unknown room/slug, or sharing not published
  | "unknown_code" // no participant with that CBT ID in this room
  | "not_finished" // attempt still running
  | "not_graded"; // absent — sat nothing, so there is nothing to analyse

export type CbtReportVerdict = "correct" | "wrong" | "skipped" | "review";

export type CbtReportQuestion = {
  position: number;
  /** Section key + label this question belongs to. */
  sectionKey: string;
  sectionLabel: string;
  questionType: CbtQuestionType | string;
  stem: string;
  image: string | null;
  options: string[];
  /** The student's answer, rendered for display. Empty when skipped. */
  yourAnswer: string;
  /** The correct answer, rendered for display. Empty when not determinable. */
  correctAnswer: string;
  explanation: string | null;
  marks: number;
  marksAwarded: number;
  verdict: CbtReportVerdict;
  timeSeconds: number;
};

export type CbtReportCard = {
  institute: { name: string | null; logo: string | null };
  test: { title: string; roomName: string; date: string | null };
  student: { displayName: string; studentCode: string };
  totals: {
    score: number;
    maxScore: number;
    percentage: number;
    rank: number | null;
    totalParticipants: number;
    accuracy: number;
    totalQuestions: number;
    attempted: number;
    correct: number;
    wrong: number;
    skipped: number;
    needsReview: number;
    /** Wall-clock time on the paper (from the room clock). */
    timeTakenSeconds: number | null;
    autoSubmitted: boolean;
    finalizeReason: CbtFinalizeReason | null;
  };
  sections: CbtSectionScore[];
  questions: CbtReportQuestion[];
  timing: {
    /** False for attempts finished before per-question timing shipped. */
    available: boolean;
    /** Sum of per-question seconds — always ≤ timeTakenSeconds. */
    accountedSeconds: number;
    averageSeconds: number;
    slowest: { position: number; seconds: number } | null;
    fastest: { position: number; seconds: number } | null;
  };
};

// ── Answer rendering ─────────────────────────────────────────────────────────

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function optionLabel(index: number, options: string[]): string {
  const letter = OPTION_LABELS[index] ?? String(index + 1);
  const text = options[index];
  return text ? `${letter}. ${text}` : letter;
}

type StoredOption = { text?: unknown } | string;

function optionTexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: StoredOption) => (typeof o === "string" ? o : String((o as { text?: unknown })?.text ?? "")));
}

/**
 * Renders a submitted or correct answer as display text.
 *
 * Deliberately tolerant: the snapshot is JSONB written over several months of
 * question-type additions, so an unexpected shape must degrade to "—" rather
 * than break a student's whole report.
 */
function renderAnswer(
  value: Record<string, unknown> | null | undefined,
  options: string[],
  { correct }: { correct: boolean },
): string {
  if (!value || typeof value !== "object") return "";

  const single = correct ? value.correctOption : value.selectedOption;
  if (typeof single === "number") return optionLabel(single, options);

  const multi = correct ? value.correctOptions : value.selectedOptions;
  if (Array.isArray(multi) && multi.length > 0) {
    return multi
      .filter((n): n is number => typeof n === "number")
      .map((n) => optionLabel(n, options))
      .join(", ");
  }

  const pairs = correct
    ? ((value.matrixData as { correct_pairs?: unknown } | undefined)?.correct_pairs as unknown)
    : value.matrixPairs;
  if (Array.isArray(pairs) && pairs.length > 0) {
    return pairs
      .filter((p): p is number[] => Array.isArray(p))
      .map((p) => p.join("→"))
      .join(", ");
  }

  const text = value.answerText;
  if (typeof text === "string" && text.trim()) return text.trim();

  return "";
}

function hasAnswerValue(a: Record<string, unknown>): boolean {
  const text = a.answerText;
  if (typeof text === "string" && text.trim() !== "") return true;
  if (typeof a.selectedOption === "number") return true;
  if (Array.isArray(a.selectedOptions) && a.selectedOptions.length > 0) return true;
  if (Array.isArray(a.matrixPairs) && a.matrixPairs.length > 0) return true;
  return false;
}

// ── Access resolution ────────────────────────────────────────────────────────

export type CbtReportTarget = { roomId: string; participantId: string };

type RoomGate = {
  roomId: string;
  roomName: string;
  roomStatus: string;
  testTitle: string;
  endedAt: string | null;
  instituteName: string | null;
  instituteLogo: string | null;
};

/**
 * Resolves a public slug to a room whose reports are actually shareable.
 *
 * Every gate collapses to `null` — a caller cannot tell "no such room" from
 * "this teacher's add-on is off" from "not published yet".
 */
async function loadPublishedRoom(slug: string): Promise<RoomGate | null> {
  if (!isFeatureEnabled("cbtReportCards") || !isFeatureEnabled("cbtModule")) return null;
  await ensureCbtSchema();

  const res = await pool().query(
    `SELECT r.id, r.name, r.status, r.ended_at, r.report_share_enabled,
            t.title AS test_title,
            tea.display_name AS institute_name, tea.logo AS institute_logo,
            tea.report_cards_enabled, tea.status AS teacher_status
       FROM cbt.rooms r
       JOIN cbt.teachers tea ON tea.id = r.teacher_id
       LEFT JOIN cbt.tests t ON t.id = r.test_id
      WHERE r.public_slug = $1`,
    [slug],
  );
  const row = res.rows[0];
  if (!row) return null;
  if (row.teacher_status !== "active") return null;
  if (row.report_cards_enabled !== true) return null;
  if (row.report_share_enabled !== true) return null;

  // A room whose clock has run out is finalized before we decide it isn't
  // finished — otherwise a student could reach the link in the gap between the
  // deadline and the sweep and be told their result isn't ready.
  if (row.status === "in_test") {
    await finalizeExpiredRoom(String(row.id)).catch(() => undefined);
    const again = await pool().query(`SELECT status, ended_at FROM cbt.rooms WHERE id = $1`, [row.id]);
    row.status = again.rows[0]?.status ?? row.status;
    row.ended_at = again.rows[0]?.ended_at ?? row.ended_at;
  }
  // Never expose an answer key while anyone in the room could still be sitting.
  if (row.status !== "finished" && row.status !== "closed") return null;

  return {
    roomId: String(row.id),
    roomName: String(row.name ?? ""),
    roomStatus: String(row.status),
    testTitle: String(row.test_title ?? row.name ?? "Test"),
    endedAt: row.ended_at ? new Date(row.ended_at as string).toISOString() : null,
    instituteName: row.institute_name ? String(row.institute_name) : null,
    instituteLogo: row.institute_logo ? String(row.institute_logo) : null,
  };
}

/**
 * What the public gate page may render before a code is entered: the room name
 * and the institute lockup, nothing about any participant. Returns null (→ 404)
 * for every failed gate, so the page cannot confirm a room exists either.
 */
export async function getPublicReportRoomBySlug(slug: string): Promise<{
  roomName: string;
  instituteName: string | null;
  instituteLogo: string | null;
} | null> {
  const room = await loadPublishedRoom(slug);
  if (!room) return null;
  return {
    roomName: room.testTitle || room.roomName,
    instituteName: room.instituteName,
    instituteLogo: room.instituteLogo,
  };
}

/**
 * Public unlock: slug + the CBT ID the student was given during the test.
 *
 * The ID is the credential (that is the flow this feature is specified as), so
 * the endpoint that calls this is rate-limited on both attempts and failures,
 * and the 128-bit room slug is the second factor.
 */
export async function resolveReportByStudentCode(
  slug: string,
  rawCode: string,
): Promise<{ ok: true; target: CbtReportTarget } | { ok: false; reason: CbtReportDenial }> {
  const room = await loadPublishedRoom(slug);
  if (!room) return { ok: false, reason: "not_found" };

  const code = normalizeStudentCode(rawCode);
  const res = await pool().query(
    `SELECT id, finished_at, finalize_reason
       FROM cbt.room_participants
      WHERE room_id = $1 AND student_code = $2`,
    [room.roomId, code],
  );
  const row = res.rows[0];
  if (!row) return { ok: false, reason: "unknown_code" };
  if (!row.finished_at) return { ok: false, reason: "not_finished" };

  // An absent attempt was recorded as finished so the room could close, but it
  // was never graded. Showing 0 / 300 would be a false record of a paper the
  // student never opened.
  const reason = isCbtFinalizeReason(row.finalize_reason) ? row.finalize_reason : null;
  if (reason && !isGradedReason(reason)) return { ok: false, reason: "not_graded" };

  return { ok: true, target: { roomId: room.roomId, participantId: String(row.id) } };
}

/** Re-checks the whole gate for an already-issued report token. */
export async function assertReportStillPublished(roomId: string): Promise<boolean> {
  if (!isFeatureEnabled("cbtReportCards") || !isFeatureEnabled("cbtModule")) return false;
  const res = await pool().query(
    `SELECT r.status, r.report_share_enabled, tea.report_cards_enabled, tea.status AS teacher_status
       FROM cbt.rooms r
       JOIN cbt.teachers tea ON tea.id = r.teacher_id
      WHERE r.id = $1`,
    [roomId],
  );
  const row = res.rows[0];
  if (!row) return false;
  return (
    row.teacher_status === "active" &&
    row.report_cards_enabled === true &&
    row.report_share_enabled === true &&
    (row.status === "finished" || row.status === "closed")
  );
}

// ── The report itself ────────────────────────────────────────────────────────

/**
 * Builds the full report for one participant. Callers MUST have passed the
 * gate above (public route) or be the owning teacher (authenticated route).
 */
export async function getCbtReportCard(target: CbtReportTarget): Promise<CbtReportCard | null> {
  await ensureCbtSchema();

  const roomRes = await pool().query(
    `SELECT r.id, r.name, r.ended_at, r.created_at,
            t.title AS test_title,
            tea.display_name AS institute_name, tea.logo AS institute_logo,
            (SELECT COUNT(*) FROM cbt.room_participants p
              WHERE p.room_id = r.id AND p.finished_at IS NOT NULL)::int AS total_participants
       FROM cbt.rooms r
       JOIN cbt.teachers tea ON tea.id = r.teacher_id
       LEFT JOIN cbt.tests t ON t.id = r.test_id
      WHERE r.id = $1`,
    [target.roomId],
  );
  const room = roomRes.rows[0];
  if (!room) return null;

  const pRes = await pool().query(
    `SELECT id, display_name, student_code, score, max_score, rank, time_taken_seconds,
            finished_at, auto_submitted, finalize_reason, section_scores
       FROM cbt.room_participants WHERE id = $1 AND room_id = $2`,
    [target.participantId, target.roomId],
  );
  const p = pRes.rows[0];
  if (!p || !p.finished_at) return null;

  const aRes = await pool().query(
    `SELECT position, question_snapshot, submitted_answer, grading_result, marks_awarded,
            time_spent_seconds
       FROM cbt.submission_answers
      WHERE room_id = $1 AND participant_id = $2
      ORDER BY position ASC`,
    [target.roomId, target.participantId],
  );

  const sectionMap = await loadSectionScores(target.roomId, [
    { id: target.participantId, sectionScores: p.section_scores, finished: true },
  ]);
  const sections = orderedSections(sectionMap[target.participantId]);
  const sectionByKey = new Map(sections.map((s) => [s.key, s]));

  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let needsReview = 0;
  let accountedSeconds = 0;
  let slowest: { position: number; seconds: number } | null = null;
  let fastest: { position: number; seconds: number } | null = null;

  const questions: CbtReportQuestion[] = aRes.rows.map((r) => {
    const snap = (r.question_snapshot ?? {}) as Record<string, unknown>;
    const grading = (r.grading_result ?? {}) as { isCorrect?: boolean; needsReview?: boolean };
    const submitted = (r.submitted_answer ?? {}) as Record<string, unknown>;
    const options = optionTexts(snap.options);

    const attempted = hasAnswerValue(submitted);
    const review = Boolean(grading.needsReview);
    const isCorrect = Boolean(grading.isCorrect);

    let verdict: CbtReportVerdict;
    if (review) {
      verdict = "review";
      needsReview += 1;
    } else if (!attempted) {
      verdict = "skipped";
      skipped += 1;
    } else if (isCorrect) {
      verdict = "correct";
      correct += 1;
    } else {
      verdict = "wrong";
      wrong += 1;
    }

    const rawSubject = typeof snap.subject === "string" ? snap.subject : null;
    const key = (rawSubject ?? "").trim().toLowerCase() || "general";
    const seconds = Number(r.time_spent_seconds ?? 0);
    accountedSeconds += seconds;
    const position = Number(r.position);
    if (seconds > 0) {
      if (!slowest || seconds > slowest.seconds) slowest = { position, seconds };
      if (!fastest || seconds < fastest.seconds) fastest = { position, seconds };
    }

    return {
      position,
      sectionKey: key,
      sectionLabel: sectionByKey.get(key)?.label ?? (rawSubject?.trim() || "General"),
      questionType: String(snap.questionType ?? "mcq"),
      stem: String(snap.stem ?? ""),
      image: typeof snap.image === "string" && snap.image.trim() ? snap.image : null,
      options,
      yourAnswer: renderAnswer(submitted, options, { correct: false }),
      // The answer key. Released only through this service, and only once the
      // room is finished — the attempt payload's sanitizer is untouched.
      correctAnswer: renderAnswer(snap.answer as Record<string, unknown>, options, { correct: true }),
      explanation: typeof snap.explanation === "string" && snap.explanation.trim() ? snap.explanation : null,
      marks: Number(snap.marks ?? 0),
      marksAwarded: Number(r.marks_awarded ?? 0),
      verdict,
      timeSeconds: seconds,
    };
  });

  const score = p.score != null ? Number(p.score) : 0;
  const maxScore = p.max_score != null ? Number(p.max_score) : 0;
  const attempted = correct + wrong;
  const timedQuestions = questions.filter((q) => q.timeSeconds > 0).length;

  return {
    institute: {
      name: room.institute_name ? String(room.institute_name) : null,
      logo: room.institute_logo ? String(room.institute_logo) : null,
    },
    test: {
      title: String(room.test_title ?? room.name ?? "Test"),
      roomName: String(room.name ?? ""),
      date: room.ended_at
        ? new Date(room.ended_at as string).toISOString()
        : room.created_at
          ? new Date(room.created_at as string).toISOString()
          : null,
    },
    student: {
      displayName: String(p.display_name ?? ""),
      studentCode: String(p.student_code ?? ""),
    },
    totals: {
      score,
      maxScore,
      percentage: maxScore > 0 ? Number(((score / maxScore) * 100).toFixed(1)) : 0,
      rank: p.rank != null ? Number(p.rank) : null,
      totalParticipants: Number(room.total_participants ?? 0),
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
      totalQuestions: questions.length,
      attempted,
      correct,
      wrong,
      skipped,
      needsReview,
      timeTakenSeconds: p.time_taken_seconds != null ? Number(p.time_taken_seconds) : null,
      autoSubmitted: Boolean(p.auto_submitted),
      finalizeReason: isCbtFinalizeReason(p.finalize_reason) ? p.finalize_reason : null,
    },
    // A single-section paper's breakdown only restates the total.
    sections: sections.length > 1 ? sections : [],
    questions,
    timing: {
      available: timedQuestions > 0,
      accountedSeconds,
      averageSeconds: timedQuestions > 0 ? Math.round(accountedSeconds / timedQuestions) : 0,
      slowest,
      fastest,
    },
  };
}

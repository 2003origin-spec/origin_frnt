/**
 * CBT rooms + anonymous participant identity + realtime presence. Teacher-scoped
 * (teacher_id) everywhere; students are identified only by a signed room-bound
 * participant token — no origin_users rows are ever created for them.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { generateRoomCode, hashRoomCode, normalizeRoomCode } from "@/lib/study-rooms/code";
import { generateRoomSlug, generateStudentCode, normalizeStudentCode } from "@/lib/cbt/student-code";
import { signParticipantToken, verifyParticipantToken } from "@/lib/cbt/participant-token";
import type { CbtParticipantSummary, CbtRoomEvent } from "@/lib/cbt/events";
import type {
  CbtParticipant,
  CbtRejoinPolicy,
  CbtRoom,
  CbtRoomStatus,
  CbtRoomWithParticipants,
} from "@/lib/cbt/room-model";
import { CBT_PRESENCE_WINDOW_MS, isCbtFinalizeReason } from "@/lib/cbt/finalize-reason";
import { normalizeParticipantName, pickReclaimCandidates, type CbtReclaimCandidate } from "@/lib/cbt/reclaim";

import { ensureCbtSchema } from "./cbt-schema";
import { appendCbtRoomEvent, deleteCbtRoomStream } from "./cbt-redis";
import { cbtId } from "./ids";

export type { CbtParticipant, CbtRejoinPolicy, CbtRoom, CbtRoomStatus, CbtRoomWithParticipants };
export type { CbtReclaimCandidate };

const PRESENCE_WINDOW_MS = CBT_PRESENCE_WINDOW_MS;
const MAX_CAPACITY = 500;
const MAX_DISPLAY_NAME = 60;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function cbtError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

const ROOM_COLUMNS = `id, teacher_id, name, public_slug, status, test_id, started_at, duration_seconds,
  ended_at, capacity, rejoin_policy, report_share_enabled, created_at, updated_at`;
const PARTICIPANT_COLUMNS = `id, room_id, display_name, student_code, token_version, joined_at, kicked, entered_test_at, last_seen_at, finished_at, auto_submitted, finalize_reason, rejoin_count, last_rejoin_at, violation_count, answered_count, score, max_score, rank, time_taken_seconds`;

function mapRoom(row: Record<string, unknown>): CbtRoom {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    name: String(row.name ?? ""),
    publicSlug: String(row.public_slug),
    status: (row.status as CbtRoomStatus) ?? "lobby",
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

function participantStatus(
  row: { last_seen_at: unknown; entered_test_at: unknown; finished_at: unknown },
  roomStatus: CbtRoomStatus,
  now: number,
): CbtParticipantSummary["status"] {
  if (row.finished_at) return "submitted";
  const lastSeen = row.last_seen_at ? new Date(row.last_seen_at as string).getTime() : 0;
  const online = now - lastSeen <= PRESENCE_WINDOW_MS;
  if (!online) return "offline";
  if (roomStatus === "in_test" && row.entered_test_at) return "giving_test";
  return "in_lobby";
}

function mapParticipant(row: Record<string, unknown>, roomStatus: CbtRoomStatus, now = Date.now()): CbtParticipant {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    displayName: String(row.display_name ?? ""),
    studentCode: String(row.student_code),
    status: participantStatus(row as never, roomStatus, now),
    joinedAt: new Date(row.joined_at as string).toISOString(),
    enteredTestAt: row.entered_test_at ? new Date(row.entered_test_at as string).toISOString() : null,
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
    autoSubmitted: Boolean(row.auto_submitted),
    finalizeReason: isCbtFinalizeReason(row.finalize_reason) ? row.finalize_reason : null,
    rejoinCount: Number(row.rejoin_count ?? 0),
    lastRejoinAt: row.last_rejoin_at ? new Date(row.last_rejoin_at as string).toISOString() : null,
    violationCount: Number(row.violation_count ?? 0),
    answeredCount: Number(row.answered_count ?? 0),
    score: row.score != null ? Number(row.score) : null,
    maxScore: row.max_score != null ? Number(row.max_score) : null,
    rank: row.rank != null ? Number(row.rank) : null,
    timeTakenSeconds: row.time_taken_seconds != null ? Number(row.time_taken_seconds) : null,
  };
}

function sanitizeDisplayName(raw: string): string {
  // Strip control chars, collapse whitespace, cap length.
  const cleaned = raw.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, MAX_DISPLAY_NAME);
}

// ── Teacher-side room management ────────────────────────────────────────────

export async function createRoom(
  teacherId: string,
  input: { name?: string; capacity?: number; rejoinPolicy?: CbtRejoinPolicy },
): Promise<{ room: CbtRoom; code: string }> {
  await ensureCbtSchema();
  const name = (input.name ?? "").trim() || "Untitled room";
  const capacity = Math.min(Math.max(1, Math.floor(Number(input.capacity) || 200)), MAX_CAPACITY);
  const rejoinPolicy: CbtRejoinPolicy = input.rejoinPolicy === "id_only" ? "id_only" : "name_or_id";
  const code = generateRoomCode();
  const slug = generateRoomSlug();
  const res = await pool().query(
    `INSERT INTO cbt.rooms (id, teacher_id, name, public_slug, code_hash, status, capacity, rejoin_policy)
       VALUES ($1, $2, $3, $4, $5, 'lobby', $6, $7)
     RETURNING ${ROOM_COLUMNS}`,
    [cbtId("cbtroom"), teacherId, name, slug, hashRoomCode(code), capacity, rejoinPolicy],
  );
  return { room: mapRoom(res.rows[0]), code };
}

/** Toggles how students may recover a lost session (teacher-scoped). */
export async function setRoomRejoinPolicy(
  teacherId: string,
  roomId: string,
  rejoinPolicy: CbtRejoinPolicy,
): Promise<CbtRoom | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `UPDATE cbt.rooms SET rejoin_policy = $3, updated_at = NOW()
       WHERE teacher_id = $1 AND id = $2
     RETURNING ${ROOM_COLUMNS}`,
    [teacherId, roomId, rejoinPolicy === "id_only" ? "id_only" : "name_or_id"],
  );
  return res.rows[0] ? mapRoom(res.rows[0]) : null;
}

/**
 * Publishes (or unpublishes) this room's participant report cards.
 *
 * Two separate switches guard the public link on purpose: the ADMIN one on the
 * teacher (the premium entitlement) and this one on the room (the teacher's own
 * "these results are ready to share"). A teacher whose add-on is off cannot
 * publish at all, so a lapsed subscription can never leave a live link behind.
 */
export async function setRoomReportShare(
  teacherId: string,
  roomId: string,
  enabled: boolean,
): Promise<CbtRoom | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `UPDATE cbt.rooms SET report_share_enabled = $3, updated_at = NOW()
       WHERE teacher_id = $1 AND id = $2
     RETURNING ${ROOM_COLUMNS}`,
    [teacherId, roomId, enabled],
  );
  return res.rows[0] ? mapRoom(res.rows[0]) : null;
}

export async function listRooms(teacherId: string): Promise<(CbtRoom & { participantCount: number })[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${ROOM_COLUMNS},
            (SELECT COUNT(*) FROM cbt.room_participants p WHERE p.room_id = r.id) AS participant_count
       FROM cbt.rooms r WHERE r.teacher_id = $1 ORDER BY r.created_at DESC`,
    [teacherId],
  );
  return res.rows.map((row) => ({ ...mapRoom(row), participantCount: Number(row.participant_count ?? 0) }));
}

/** Minimal, unauthenticated room lookup by public slug (student landing page). */
export async function getPublicRoomBySlug(
  slug: string,
): Promise<{
  id: string;
  name: string;
  status: CbtRoomStatus;
  instituteName: string | null;
  instituteLogo: string | null;
} | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT r.id, r.name, r.status, t.display_name AS institute_name, t.logo AS institute_logo
       FROM cbt.rooms r
       JOIN cbt.teachers t ON t.id = r.teacher_id
      WHERE r.public_slug = $1`,
    [slug],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    status: (row.status as CbtRoomStatus) ?? "lobby",
    instituteName: row.institute_name ? String(row.institute_name) : null,
    instituteLogo: row.institute_logo ? String(row.institute_logo) : null,
  };
}

export async function getRoomForTeacher(teacherId: string, roomId: string): Promise<CbtRoom | null> {
  await ensureCbtSchema();
  const res = await pool().query(`SELECT ${ROOM_COLUMNS} FROM cbt.rooms WHERE teacher_id = $1 AND id = $2`, [
    teacherId,
    roomId,
  ]);
  return res.rows[0] ? mapRoom(res.rows[0]) : null;
}

export async function getRoomWithParticipants(
  teacherId: string,
  roomId: string,
): Promise<CbtRoomWithParticipants | null> {
  let room = await getRoomForTeacher(teacherId, roomId);
  if (!room) return null;
  // Reading a past-deadline room finalizes it first, so the teacher never sees
  // (or exports) a student left unsubmitted because their browser died.
  if (await finalizeIfExpired(room)) {
    room = (await getRoomForTeacher(teacherId, roomId)) ?? room;
  }
  const participants = await listParticipants(roomId, room.status);
  return { ...room, participants };
}

/**
 * Lazy deadline finalization. Imported dynamically because the attempts service
 * imports this module — a static edge would be a cycle.
 */
export async function finalizeIfExpired(room: Pick<CbtRoom, "id" | "status">): Promise<boolean> {
  if (room.status !== "in_test") return false;
  try {
    const { finalizeExpiredRoom } = await import("./cbt-attempts-service");
    return (await finalizeExpiredRoom(room.id)) > 0;
  } catch (error) {
    // Never let a finalize failure break a read path; the cron retries.
    console.error("[cbt] lazy finalize failed", error);
    return false;
  }
}

export async function listParticipants(roomId: string, roomStatus: CbtRoomStatus): Promise<CbtParticipant[]> {
  const res = await pool().query(
    `SELECT ${PARTICIPANT_COLUMNS} FROM cbt.room_participants WHERE room_id = $1 ORDER BY joined_at ASC`,
    [roomId],
  );
  const now = Date.now();
  return res.rows.map((row) => mapParticipant(row, roomStatus, now));
}

export async function regenerateRoomCode(teacherId: string, roomId: string): Promise<{ code: string } | null> {
  await ensureCbtSchema();
  const code = generateRoomCode();
  const res = await pool().query(
    `UPDATE cbt.rooms SET code_hash = $3, updated_at = NOW() WHERE teacher_id = $1 AND id = $2 RETURNING id`,
    [teacherId, roomId, hashRoomCode(code)],
  );
  return res.rows[0] ? { code } : null;
}

/** Assigns a ready test to a lobby room (teacher's own test only). */
export async function configureRoomTest(teacherId: string, roomId: string, testId: string): Promise<CbtRoom> {
  await ensureCbtSchema();
  const test = await pool().query(
    `SELECT id, title, status FROM cbt.tests WHERE id = $1 AND teacher_id = $2`,
    [testId, teacherId],
  );
  if (!test.rows[0]) throw cbtError(404, "Test not found.");
  if (test.rows[0].status !== "ready") throw cbtError(400, "Mark the test ready before assigning it.");

  const res = await pool().query(
    `UPDATE cbt.rooms SET test_id = $3, updated_at = NOW()
       WHERE teacher_id = $1 AND id = $2 AND status = 'lobby'
     RETURNING ${ROOM_COLUMNS}`,
    [teacherId, roomId, testId],
  );
  if (!res.rows[0]) throw cbtError(409, "The test can only be assigned while the room is in the lobby.");
  const room = mapRoom(res.rows[0]);
  await publishRoomEvent(roomId, { type: "test_configured", test_id: testId, title: String(test.rows[0].title) });
  return room;
}

/**
 * Starts the assigned test: anchors started_at 3s in the future (client + server
 * timers agree), freezes the (immutable, ready-test) question order, flips the
 * room to in_test, and broadcasts test_started.
 */
export async function startRoomTest(
  teacherId: string,
  roomId: string,
): Promise<{ startedAt: string; durationSeconds: number }> {
  await ensureCbtSchema();
  const meta = await pool().query(
    `SELECT t.duration_minutes
       FROM cbt.rooms r JOIN cbt.tests t ON t.id = r.test_id
      WHERE r.teacher_id = $1 AND r.id = $2 AND r.status = 'lobby'`,
    [teacherId, roomId],
  );
  if (!meta.rows[0]) throw cbtError(409, "Assign a test and keep the room in the lobby before starting.");
  const durationSeconds = Math.max(30, Number(meta.rows[0].duration_minutes ?? 60) * 60);

  const res = await pool().query(
    `UPDATE cbt.rooms
        SET status = 'in_test', started_at = NOW() + INTERVAL '3 seconds',
            duration_seconds = $3, updated_at = NOW()
      WHERE teacher_id = $1 AND id = $2 AND status = 'lobby' AND test_id IS NOT NULL
      RETURNING started_at, duration_seconds`,
    [teacherId, roomId, durationSeconds],
  );
  if (!res.rows[0]) throw cbtError(409, "Room cannot be started.");
  const startedAt = new Date(res.rows[0].started_at as string).toISOString();
  await publishRoomEvent(roomId, {
    type: "test_started",
    started_at: startedAt,
    duration_seconds: durationSeconds,
    server_emit_ts: Date.now(),
  });
  await publishPresence(roomId, "in_test");
  return { startedAt, durationSeconds };
}

export async function closeRoom(teacherId: string, roomId: string): Promise<boolean> {
  await ensureCbtSchema();

  // Grade everyone still in the paper BEFORE closing. A closed room is
  // unreachable for students and invisible to the deadline sweep, so anyone
  // left unfinished here would have been stranded as "absent" with no score
  // even though the server was holding their answers.
  const room = await getRoomForTeacher(teacherId, roomId);
  if (room?.status === "in_test") {
    try {
      const { finalizeRoomNow } = await import("./cbt-attempts-service");
      await finalizeRoomNow(roomId, "room_closed");
    } catch (error) {
      console.error("[cbt] finalize-before-close failed", error);
    }
  }

  const res = await pool().query(
    `UPDATE cbt.rooms SET status = 'closed', ended_at = NOW(), updated_at = NOW()
       WHERE teacher_id = $1 AND id = $2 AND status != 'closed' RETURNING id`,
    [teacherId, roomId],
  );
  if (!res.rows[0]) return false;
  await publishRoomEvent(roomId, { type: "room_closed" });
  await deleteCbtRoomStream(roomId).catch(() => undefined);
  return true;
}

export async function deleteRoom(teacherId: string, roomId: string): Promise<boolean> {
  await ensureCbtSchema();
  const res = await pool().query(`DELETE FROM cbt.rooms WHERE teacher_id = $1 AND id = $2`, [teacherId, roomId]);
  if ((res.rowCount ?? 0) > 0) {
    await deleteCbtRoomStream(roomId).catch(() => undefined);
    return true;
  }
  return false;
}

export async function kickParticipant(teacherId: string, roomId: string, participantId: string): Promise<boolean> {
  await ensureCbtSchema();
  // Ownership check via the room, then bump token_version to invalidate tokens.
  const room = await getRoomForTeacher(teacherId, roomId);
  if (!room) return false;
  const res = await pool().query(
    `UPDATE cbt.room_participants SET kicked = TRUE, token_version = token_version + 1
       WHERE room_id = $1 AND id = $2 RETURNING id`,
    [roomId, participantId],
  );
  if (!res.rows[0]) return false;
  await publishRoomEvent(roomId, { type: "kicked", participant_id: participantId });
  await publishPresence(roomId, room.status);
  return true;
}

// ── Student-side anonymous identity ─────────────────────────────────────────

export type CbtJoinResult =
  | {
      kind: "joined";
      participant: CbtParticipant;
      token: string;
      studentCode: string;
      roomId: string;
    }
  | {
      /**
       * An unfinished attempt under this name is sitting idle in the room. We
       * refuse to silently create a second identity (that is what stranded
       * students as "absent" with a blank score) and instead let them confirm.
       */
      kind: "reclaim_available";
      roomId: string;
      candidates: CbtReclaimCandidate[];
    };

export async function joinRoom(input: {
  slug: string;
  code: string;
  displayName: string;
  /** Set by the student after confirming the prompt; skips the probe. */
  forceNew?: boolean;
}): Promise<CbtJoinResult> {
  await ensureCbtSchema();
  const displayName = sanitizeDisplayName(input.displayName);
  if (!displayName) throw cbtError(400, "Please enter your name.");

  const roomRes = await pool().query(`SELECT ${ROOM_COLUMNS}, code_hash FROM cbt.rooms WHERE public_slug = $1`, [
    input.slug,
  ]);
  const roomRow = roomRes.rows[0];
  if (!roomRow) throw cbtError(404, "This room does not exist.");
  if (roomRow.status === "closed") throw cbtError(410, "This room has closed.");
  if (hashRoomCode(input.code) !== roomRow.code_hash) throw cbtError(403, "Incorrect room code.");

  const room = mapRoom(roomRow);

  // Identity recovery probe: does this name already have an idle, unfinished
  // attempt here? Only offered for attempts nobody is currently sitting at, so
  // a live session can never be taken over.
  if (!input.forceNew) {
    const candidates = await findReclaimCandidates(room, displayName);
    if (candidates.length > 0) return { kind: "reclaim_available", roomId: room.id, candidates };
  }

  const count = await pool().query(`SELECT COUNT(*)::int AS n FROM cbt.room_participants WHERE room_id = $1`, [room.id]);
  if ((count.rows[0]?.n ?? 0) >= room.capacity) throw cbtError(409, "This room is full.");

  // Insert the participant, retrying on a student-code collision.
  let participantRow: Record<string, unknown> | null = null;
  for (let attempt = 0; attempt < 5 && !participantRow; attempt += 1) {
    const studentCode = generateStudentCode();
    try {
      const res = await pool().query(
        `INSERT INTO cbt.room_participants (id, room_id, display_name, student_code, last_seen_at)
           VALUES ($1, $2, $3, $4, NOW())
         RETURNING ${PARTICIPANT_COLUMNS}`,
        [cbtId("cbtp"), room.id, displayName, studentCode],
      );
      participantRow = res.rows[0];
    } catch (error) {
      if ((error as { code?: string })?.code === "23505") continue; // unique(room_id, student_code) collision
      throw error;
    }
  }
  if (!participantRow) throw cbtError(500, "Could not join the room. Please try again.");

  const participant = mapParticipant(participantRow, room.status);
  const token = await signParticipantToken({
    room_id: room.id,
    participant_id: participant.id,
    tv: Number(participantRow.token_version ?? 1),
  });

  await publishRoomEvent(room.id, { type: "participant_joined", participant: toSummary(participantRow, room.status) });
  await publishPresence(room.id, room.status);

  return { kind: "joined", participant, token, studentCode: participant.studentCode, roomId: room.id };
}

/** Idle unfinished attempts in this room that the entered name may reclaim. */
async function findReclaimCandidates(room: CbtRoom, displayName: string): Promise<CbtReclaimCandidate[]> {
  if (room.rejoinPolicy === "id_only") return [];
  if (!normalizeParticipantName(displayName)) return [];
  const res = await pool().query(
    `SELECT id, display_name, student_code, answered_count, last_seen_at, finished_at, kicked
       FROM cbt.room_participants
      WHERE room_id = $1 AND finished_at IS NULL AND kicked = FALSE`,
    [room.id],
  );
  return pickReclaimCandidates({
    rows: res.rows.map((row) => ({
      participantId: String(row.id),
      displayName: String(row.display_name ?? ""),
      studentCode: String(row.student_code),
      answeredCount: Number(row.answered_count ?? 0),
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
      finishedAt: row.finished_at ? new Date(row.finished_at as string).toISOString() : null,
      kicked: Boolean(row.kicked),
    })),
    enteredName: displayName,
    policy: room.rejoinPolicy,
    now: Date.now(),
  });
}

/**
 * Hands a specific idle attempt back to the student who confirmed it is theirs.
 *
 * Bumping `token_version` is deliberate: it invalidates every other outstanding
 * token for this participant, so the device they abandoned can no longer save
 * over the answers they are about to continue writing.
 */
export async function reclaimParticipant(input: {
  slug: string;
  code: string;
  displayName: string;
  participantId: string;
}): Promise<{ token: string; roomId: string; participantId: string; studentCode: string }> {
  await ensureCbtSchema();
  const displayName = sanitizeDisplayName(input.displayName);

  const roomRes = await pool().query(`SELECT ${ROOM_COLUMNS}, code_hash FROM cbt.rooms WHERE public_slug = $1`, [
    input.slug,
  ]);
  const roomRow = roomRes.rows[0];
  if (!roomRow) throw cbtError(404, "This room does not exist.");
  if (roomRow.status === "closed") throw cbtError(410, "This room has closed.");
  if (hashRoomCode(input.code) !== roomRow.code_hash) throw cbtError(403, "Incorrect room code.");
  const room = mapRoom(roomRow);

  // Re-derive the candidate list rather than trusting the id from the client:
  // policy, name match, unfinished and offline are all re-checked here.
  const candidates = await findReclaimCandidates(room, displayName);
  const match = candidates.find((c) => c.participantId === input.participantId);
  if (!match) {
    throw cbtError(409, "That attempt can no longer be resumed. Please start again or use your Student ID.");
  }

  return grantSession(room, match.participantId, match.studentCode);
}

/**
 * Issues a fresh session for an existing participant and records the rejoin.
 * Shared by the reclaim path and the Student-ID resume path.
 */
async function grantSession(
  room: CbtRoom,
  participantId: string,
  studentCode: string,
): Promise<{ token: string; roomId: string; participantId: string; studentCode: string }> {
  const updated = await pool().query(
    `UPDATE cbt.room_participants
        SET token_version = token_version + 1,
            rejoin_count = rejoin_count + 1,
            last_rejoin_at = NOW(),
            last_seen_at = NOW()
      WHERE id = $1 AND room_id = $2
      RETURNING token_version`,
    [participantId, room.id],
  );
  if (!updated.rows[0]) throw cbtError(404, "That attempt no longer exists.");

  const token = await signParticipantToken({
    room_id: room.id,
    participant_id: participantId,
    tv: Number(updated.rows[0].token_version ?? 1),
  });
  await publishPresence(room.id, room.status);
  return { token, roomId: room.id, participantId, studentCode };
}

export async function resumeParticipant(input: {
  roomCode: string;
  studentCode: string;
  /** Preferred when the student came from the room link — makes the match exact. */
  slug?: string;
}): Promise<{ token: string; roomId: string; participantId: string; studentCode: string } | null> {
  await ensureCbtSchema();
  const codeHash = hashRoomCode(normalizeRoomCode(input.roomCode));
  const studentCode = normalizeStudentCode(input.studentCode);
  const slug = input.slug?.trim() || null;
  const res = await pool().query(
    `SELECT p.id AS participant_id, p.student_code, p.room_id
       FROM cbt.room_participants p
       JOIN cbt.rooms r ON r.id = p.room_id
      WHERE p.student_code = $1 AND r.code_hash = $2 AND r.status != 'closed' AND p.kicked = FALSE
        AND ($3::text IS NULL OR r.public_slug = $3)
      ORDER BY p.joined_at DESC
      LIMIT 1`,
    [studentCode, codeHash, slug],
  );
  const row = res.rows[0];
  if (!row) return null;

  const roomRes = await pool().query(`SELECT ${ROOM_COLUMNS} FROM cbt.rooms WHERE id = $1`, [row.room_id]);
  if (!roomRes.rows[0]) return null;
  return grantSession(mapRoom(roomRes.rows[0]), String(row.participant_id), String(row.student_code));
}

export type ResolvedParticipant = {
  participant: CbtParticipant;
  room: CbtRoom;
};

/**
 * Verifies a participant token and loads the live participant + room. Rejects
 * kicked participants, stale token_versions, and closed rooms.
 */
export async function resolveParticipantFromToken(token: string | undefined): Promise<ResolvedParticipant | null> {
  if (!token) return null;
  const claims = await verifyParticipantToken(token);
  if (!claims) return null;
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${PARTICIPANT_COLUMNS} FROM cbt.room_participants WHERE id = $1 AND room_id = $2`,
    [claims.participant_id, claims.room_id],
  );
  const prow = res.rows[0];
  if (!prow) return null;
  if (prow.kicked || Number(prow.token_version ?? 1) !== claims.tv) return null;

  const roomRes = await pool().query(`SELECT ${ROOM_COLUMNS} FROM cbt.rooms WHERE id = $1`, [claims.room_id]);
  const roomRow = roomRes.rows[0];
  if (!roomRow || roomRow.status === "closed") return null;
  const room = mapRoom(roomRow);
  return { participant: mapParticipant(prow, room.status), room };
}

export async function recordHeartbeat(participantId: string, roomId: string, inTest: boolean): Promise<void> {
  await pool().query(
    `UPDATE cbt.room_participants
        SET last_seen_at = NOW()${inTest ? ", entered_test_at = COALESCE(entered_test_at, NOW())" : ""}
      WHERE id = $1 AND room_id = $2`,
    [participantId, roomId],
  );
}

// ── Presence ────────────────────────────────────────────────────────────────

function toSummary(row: Record<string, unknown>, roomStatus: CbtRoomStatus, now = Date.now()): CbtParticipantSummary {
  return {
    participant_id: String(row.id),
    display_name: String(row.display_name ?? ""),
    student_code: String(row.student_code),
    status: participantStatus(row as never, roomStatus, now),
    answered_count: Number(row.answered_count ?? 0),
    last_seen_at: row.last_seen_at ? new Date(row.last_seen_at as string).toISOString() : null,
  };
}

export async function buildPresence(roomId: string, roomStatus: CbtRoomStatus): Promise<CbtParticipantSummary[]> {
  const res = await pool().query(
    `SELECT ${PARTICIPANT_COLUMNS} FROM cbt.room_participants WHERE room_id = $1 ORDER BY joined_at ASC`,
    [roomId],
  );
  const now = Date.now();
  return res.rows.map((row) => toSummary(row, roomStatus, now));
}

export async function publishRoomEvent(roomId: string, event: CbtRoomEvent): Promise<void> {
  await appendCbtRoomEvent(roomId, event).catch(() => undefined);
}

export async function publishPresence(roomId: string, roomStatus: CbtRoomStatus): Promise<void> {
  const participants = await buildPresence(roomId, roomStatus);
  await publishRoomEvent(roomId, { type: "presence", participants, count: participants.length });
}

export { pool as cbtPool, cbtError, PARTICIPANT_COLUMNS, ROOM_COLUMNS, mapRoom, mapParticipant };

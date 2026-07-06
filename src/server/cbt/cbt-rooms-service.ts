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
import type { CbtParticipant, CbtRoom, CbtRoomStatus, CbtRoomWithParticipants } from "@/lib/cbt/room-model";

import { ensureCbtSchema } from "./cbt-schema";
import { appendCbtRoomEvent, deleteCbtRoomStream } from "./cbt-redis";
import { cbtId } from "./ids";

export type { CbtParticipant, CbtRoom, CbtRoomStatus, CbtRoomWithParticipants };

const PRESENCE_WINDOW_MS = 45_000;
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

const ROOM_COLUMNS = `id, teacher_id, name, public_slug, status, test_id, started_at, duration_seconds, ended_at, capacity, created_at, updated_at`;
const PARTICIPANT_COLUMNS = `id, room_id, display_name, student_code, token_version, joined_at, kicked, entered_test_at, last_seen_at, finished_at, auto_submitted, answered_count, score, max_score, rank, time_taken_seconds`;

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
  input: { name?: string; capacity?: number },
): Promise<{ room: CbtRoom; code: string }> {
  await ensureCbtSchema();
  const name = (input.name ?? "").trim() || "Untitled room";
  const capacity = Math.min(Math.max(1, Math.floor(Number(input.capacity) || 200)), MAX_CAPACITY);
  const code = generateRoomCode();
  const slug = generateRoomSlug();
  const res = await pool().query(
    `INSERT INTO cbt.rooms (id, teacher_id, name, public_slug, code_hash, status, capacity)
       VALUES ($1, $2, $3, $4, $5, 'lobby', $6)
     RETURNING ${ROOM_COLUMNS}`,
    [cbtId("cbtroom"), teacherId, name, slug, hashRoomCode(code), capacity],
  );
  return { room: mapRoom(res.rows[0]), code };
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
): Promise<{ id: string; name: string; status: CbtRoomStatus } | null> {
  await ensureCbtSchema();
  const res = await pool().query(`SELECT id, name, status FROM cbt.rooms WHERE public_slug = $1`, [slug]);
  const row = res.rows[0];
  if (!row) return null;
  return { id: String(row.id), name: String(row.name ?? ""), status: (row.status as CbtRoomStatus) ?? "lobby" };
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
  const room = await getRoomForTeacher(teacherId, roomId);
  if (!room) return null;
  const participants = await listParticipants(roomId, room.status);
  return { ...room, participants };
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

export async function joinRoom(input: {
  slug: string;
  code: string;
  displayName: string;
}): Promise<{ participant: CbtParticipant; token: string; studentCode: string; roomId: string }> {
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

  return { participant, token, studentCode: participant.studentCode, roomId: room.id };
}

export async function resumeParticipant(input: {
  roomCode: string;
  studentCode: string;
}): Promise<{ token: string; roomId: string; participantId: string } | null> {
  await ensureCbtSchema();
  const codeHash = hashRoomCode(normalizeRoomCode(input.roomCode));
  const studentCode = normalizeStudentCode(input.studentCode);
  const res = await pool().query(
    `SELECT p.id, p.token_version, p.room_id
       FROM cbt.room_participants p
       JOIN cbt.rooms r ON r.id = p.room_id
      WHERE p.student_code = $1 AND r.code_hash = $2 AND r.status != 'closed' AND p.kicked = FALSE
      LIMIT 1`,
    [studentCode, codeHash],
  );
  const row = res.rows[0];
  if (!row) return null;
  const token = await signParticipantToken({
    room_id: String(row.room_id),
    participant_id: String(row.id),
    tv: Number(row.token_version ?? 1),
  });
  return { token, roomId: String(row.room_id), participantId: String(row.id) };
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

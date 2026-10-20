/**
 * Origin NOW live room (build step 6): who may join which LiveKit room with
 * what rights, closing the room when the server ends a session, the audio
 * recording, its 30-day retention, and logged admin access to it.
 */

import { createPresignedR2PutUrl, deleteR2Object } from "@/server/media-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

import {
  deleteRoom,
  getLiveKitConfig,
  getRecordingBucket,
  getRecordingStorage,
  isAgentParticipant,
  listRoomParticipants,
  mintParticipantToken,
  PARTICIPANT_TOKEN_TTL_SECONDS,
  recordingObjectKey,
  roomNameFor,
  startAudioEgress,
  type RoomRole,
} from "./livekit";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { firstNameOnly } from "./session-rules";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function logEvent(type: string, sessionId: string, requestId: string | null, actor: string, payload: Record<string, unknown> = {}) {
  await (await db()).query(
    `INSERT INTO now.events (request_id, session_id, type, actor, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [requestId, sessionId, type, actor, JSON.stringify(payload)],
  );
}

export type RoomTicket = {
  url: string;
  token: string;
  room: string;
  identity: string;
  role: RoomRole;
  expiresAt: string;
  /** Shown as the badge in the room; both sides are told before joining. */
  recorded: boolean;
  peerName: string;
  canScreenShare: boolean;
  /** The shared board is on for this call (human solver, Settings → Extra parts; B89). */
  board: boolean;
};

/**
 * A LiveKit token for the student or the assigned human solver of a session
 * that has not ended. Refused for anyone else, and once the session is over.
 */
export async function issueRoomTicket(userId: string, sessionId: string, now: Date = new Date()): Promise<RoomTicket> {
  const res = await (await db()).query<{
    id: string;
    student_id: string;
    solver_kind: "human" | "bot";
    ended_at: Date | null;
    status: string;
    helper_user_id: string | null;
    helper_name: string | null;
    student_name: string | null;
  }>(
    `SELECT s.id, s.student_id, s.solver_kind, s.ended_at, r.status,
            h.user_id AS helper_user_id, h.display_name AS helper_name, u.name AS student_name
       FROM now.sessions s
       JOIN now.requests r ON r.id = s.request_id
       JOIN now.helpers h ON h.id = s.helper_id
       JOIN origin_users u ON u.id = s.student_id
      WHERE s.id = $1`,
    [sessionId],
  );
  const row = res.rows[0];
  const role: RoomRole | null = !row
    ? null
    : row.student_id === userId
      ? "student"
      : row.helper_user_id === userId
        ? "solver"
        : null;
  if (!row || !role) throw new NowError(404, "not_found", "Session not found.");
  if (row.ended_at || (row.status !== "accepted" && row.status !== "live")) {
    throw new NowError(409, "session_ended", "This session has ended.");
  }
  const config = getLiveKitConfig();
  if (!config) throw new NowError(503, "live_unavailable", "Live calls are not available right now.");
  const room = roomNameFor(sessionId);
  // Per-role identity, never the user id: neither side learns the other's account id.
  const identity = `${role}-${sessionId}`;
  const token = await mintParticipantToken(config, {
    room,
    identity,
    name: role === "student" ? firstNameOnly(row.student_name) : (row.helper_name ?? "Solver"),
    role,
  });
  return {
    url: config.wsUrl,
    token,
    room,
    identity,
    role,
    expiresAt: new Date(now.getTime() + PARTICIPANT_TOKEN_TTL_SECONDS * 1000).toISOString(),
    recorded: getRecordingStorage() !== null,
    peerName: role === "student" ? (row.solver_kind === "bot" ? "Origin" : (row.helper_name ?? "Solver")) : firstNameOnly(row.student_name),
    canScreenShare: role === "solver",
    board: row.solver_kind === "human" && (await getNowSettings()).features.board,
  };
}

/**
 * Is the Origin bot's agent in this session's room? Without LiveKit (local
 * development) there is no room to check, so the bot counts as present.
 */
export async function botIsInRoom(sessionId: string): Promise<boolean> {
  const config = getLiveKitConfig();
  if (!config) return true;
  try {
    return (await listRoomParticipants(config, roomNameFor(sessionId))).some(isAgentParticipant);
  } catch (error) {
    console.warn("[origin-now] could not list room participants", sessionId, error instanceof Error ? error.message : error);
    return false;
  }
}

/** Post-commit effect for every server-side end: disconnects both people. */
export async function closeRoom(sessionId: string): Promise<void> {
  const config = getLiveKitConfig();
  if (!config) return;
  try {
    await deleteRoom(config, roomNameFor(sessionId));
  } catch (error) {
    // The room also empties itself once both leave; log for the live monitor.
    console.warn("[origin-now] room close failed", sessionId, error instanceof Error ? error.message : error);
  }
}

/**
 * Post-commit effect when a session goes live. Never blocks the call: if
 * recording cannot start, the session carries on and `recording.failed` /
 * `recording.unavailable` is logged for the admin monitor (decision B27).
 */
export async function startSessionRecording(sessionId: string, requestId: string): Promise<boolean> {
  const config = getLiveKitConfig();
  const storage = getRecordingStorage();
  if (!config || !storage) {
    await logEvent("recording.unavailable", sessionId, requestId, "system", {
      reason: !config
        ? "livekit_not_configured"
        : getRecordingBucket().problem === "public"
          ? "bucket_is_public"
          : "storage_not_configured",
    });
    return false;
  }
  const objectKey = recordingObjectKey(sessionId);
  try {
    const egressId = await startAudioEgress(config, storage, { room: roomNameFor(sessionId), objectKey });
    const updated = await (await db()).query(
      `UPDATE now.sessions SET recording_key = $2, recording_egress_id = $3, recording_started_at = NOW()
        WHERE id = $1 AND recording_egress_id IS NULL`,
      [sessionId, objectKey, egressId],
    );
    await logEvent("recording.started", sessionId, requestId, "system", { egressId, stored: updated.rowCount === 1 });
    return true;
  } catch (error) {
    await logEvent("recording.failed", sessionId, requestId, "system", {
      message: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    return false;
  }
}

/** Nightly: deletes recordings past retention unless a report on the session is still open. */
export async function purgeExpiredRecordings(now: Date = new Date()): Promise<{ deleted: number; failed: number }> {
  const { recordingRetentionDays } = await getNowSettings();
  const cutoff = new Date(now.getTime() - recordingRetentionDays * 24 * 60 * 60_000);
  const pool = await db();
  const due = await pool.query<{ id: string; request_id: string; recording_key: string }>(
    `SELECT s.id, s.request_id, s.recording_key FROM now.sessions s
      WHERE s.recording_key IS NOT NULL AND s.recording_deleted_at IS NULL AND s.ended_at <= $1
        AND NOT EXISTS (SELECT 1 FROM now.reports r WHERE r.session_id = s.id AND r.status = 'open')
      ORDER BY s.ended_at LIMIT 200`,
    [cutoff],
  );
  // Without the recordings bucket there is nowhere safe to delete from: the
  // default is the public image bucket, where deleting a key that is not
  // there still succeeds and would mark a recording deleted that still
  // exists. Keep the rows (counted as failed) until the bucket is set again.
  const bucket = getRecordingBucket().name;
  if (!bucket) {
    if (due.rows.length > 0) {
      console.warn("[origin-now] recordings past retention not deleted: no private recording bucket is set", due.rows.length);
    }
    return { deleted: 0, failed: due.rows.length };
  }
  let deleted = 0;
  let failed = 0;
  for (const row of due.rows) {
    try {
      await deleteR2Object({ bucket, objectKey: row.recording_key });
      await pool.query(`UPDATE now.sessions SET recording_key = NULL, recording_deleted_at = $2 WHERE id = $1`, [row.id, now]);
      await logEvent("recording.deleted", row.id, row.request_id, "system", { retentionDays: recordingRetentionDays });
      deleted += 1;
    } catch (error) {
      failed += 1;
      console.warn("[origin-now] recording delete failed", row.id, error instanceof Error ? error.message : error);
    }
  }
  return { deleted, failed };
}

/** Admin: a 10-minute link to one recording; every open is logged as `recording.accessed`. */
export async function getRecordingLinkForAdmin(adminId: string, sessionId: string, reason: string) {
  // Never sign a link into the default (public) bucket.
  const bucket = getRecordingBucket().name;
  if (!bucket) {
    throw new NowError(503, "recording_unavailable", "Recording storage is not set up (no private bucket), so recordings cannot be opened.");
  }
  const res = await (await db()).query<{ request_id: string; recording_key: string | null; recording_deleted_at: Date | null }>(
    `SELECT request_id, recording_key, recording_deleted_at FROM now.sessions WHERE id = $1`,
    [sessionId],
  );
  const row = res.rows[0];
  if (!row) throw new NowError(404, "not_found", "Session not found.");
  if (!row.recording_key) {
    throw new NowError(404, row.recording_deleted_at ? "recording_deleted" : "no_recording", "There is no recording for this session.");
  }
  const signed = createPresignedR2PutUrl({
    objectKey: row.recording_key,
    bucket,
    method: "GET",
    expiresSeconds: 600,
  });
  await logEvent("recording.accessed", sessionId, row.request_id, adminId, { reason: reason.slice(0, 300) });
  return { url: signed.url, expiresInSeconds: 600 };
}

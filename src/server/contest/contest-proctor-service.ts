/**
 * Webcam-snapshot proctoring (Phase 3B, self-hosted). Presigns a short-lived R2
 * PUT for a captured frame and records the object key for admin review. No third
 * party — frames live in our own PRIVATE R2 bucket (R2_PRIVATE_BUCKET, the presign
 * helper's default) and admins view them through short-lived signed GETs. Gated by
 * the contestProctoring flag + the student's camera consent (client-side).
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";
import { createPresignedR2PutUrl, isUploadSize } from "@/server/media-storage";

import { ensureContestSchema } from "./contest-schema";

/** Largest frame accepted. A 320×240 JPEG at quality 0.6 is tens of KB (a busy test frame: 31 KB); its raw pixels are 225 KB. */
export const MAX_PROCTOR_SNAPSHOT_BYTES = 256 * 1024;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * Presign a JPEG upload of exactly `sizeBytes` for one snapshot; the key is
 * namespaced per user/contest. R2 refuses any other type or size.
 */
export function presignProctorSnapshot(
  contestId: string,
  userId: string,
  sizeBytes: number,
): { uploadUrl: string; uploadHeaders: Record<string, string>; r2Key: string; bucket: string } {
  if (!isUploadSize(sizeBytes, MAX_PROCTOR_SNAPSHOT_BYTES)) {
    throw new Error("A proctor photo must be between 1 byte and 256 KB.");
  }
  const r2Key = `contest-proctor/${contestId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const presigned = createPresignedR2PutUrl({
    objectKey: r2Key,
    expiresSeconds: 300,
    contentType: "image/jpeg",
    contentLength: sizeBytes,
  });
  return { uploadUrl: presigned.url, uploadHeaders: presigned.headers, r2Key: presigned.objectKey, bucket: presigned.bucket };
}

/** Record a captured snapshot's key after the browser PUT it to R2. */
export async function registerProctorSnapshot(input: { contestId: string; userId: string; r2Key: string }): Promise<void> {
  await ensureContestSchema();
  await pool().query(
    `INSERT INTO contest.proctor_snapshots (id, contest_id, user_id, r2_key) VALUES ($1, $2, $3, $4)`,
    [createId("snap"), input.contestId, input.userId, input.r2Key],
  );
}

/** Admin: snapshot keys for one participant (newest first). */
export async function listProctorSnapshots(contestId: string, userId: string, limit = 100): Promise<{ r2Key: string; capturedAt: string }[]> {
  await ensureContestSchema();
  const res = await pool().query<{ r2_key: string; captured_at: string }>(
    `SELECT r2_key, captured_at FROM contest.proctor_snapshots
      WHERE contest_id = $1 AND user_id = $2 ORDER BY captured_at DESC LIMIT $3`,
    [contestId, userId, Math.max(1, Math.min(500, limit))],
  );
  return res.rows.map((r) => ({ r2Key: r.r2_key, capturedAt: new Date(r.captured_at).toISOString() }));
}

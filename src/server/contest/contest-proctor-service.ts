/**
 * Webcam-snapshot proctoring (Phase 3B, self-hosted). Presigns a short-lived R2
 * PUT for a captured frame and records the object key for admin review. No third
 * party — frames live in our own R2 bucket. Gated by the contestProctoring flag
 * + the student's camera consent (client-side).
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";
import { createPresignedR2PutUrl, importR2BucketName } from "@/server/media-storage";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Presign a JPEG upload for one snapshot; the key is namespaced per user/contest. */
export function presignProctorSnapshot(contestId: string, userId: string): { uploadUrl: string; r2Key: string; bucket: string } {
  const r2Key = `contest-proctor/${contestId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const presigned = createPresignedR2PutUrl({ objectKey: r2Key, expiresSeconds: 300 });
  return { uploadUrl: presigned.url, r2Key: presigned.objectKey, bucket: presigned.bucket ?? importR2BucketName() };
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

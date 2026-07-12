/**
 * OGCode Friend Challenge (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §13).
 *
 * A student challenges a MUTUAL follower to a specific question. Rows live on
 * the OGCODE pool (ogcode_friend_challenges); the mutual-follow check runs on
 * the USER pool via social-service (the two are the same Neon cluster in prod,
 * separate pools in code). At most one PENDING challenge per
 * (sender, recipient, question) via the partial unique index; completed rows
 * are history. On the recipient's terminal outcome the row flips to completed
 * and the sender is notified.
 *
 * Canonical SQL: src/db/migrations/20260713_ogcode_engagement.sql
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";
import { createId } from "@/server/store";

declare global {
  var __originOgcodeChallengesSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_friend_challenges (
    id           TEXT PRIMARY KEY,
    question_id  TEXT NOT NULL,
    from_user_id TEXT NOT NULL,
    to_user_id   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempted_at TIMESTAMPTZ,
    result_score NUMERIC,
    result_time  INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ogcode_friend_challenges_pending_uniq
    ON ogcode_friend_challenges (from_user_id, to_user_id, question_id)
    WHERE status = 'pending';
  CREATE INDEX IF NOT EXISTS ogcode_friend_challenges_to_idx ON ogcode_friend_challenges (to_user_id, status);
  CREATE INDEX IF NOT EXISTS ogcode_friend_challenges_from_idx ON ogcode_friend_challenges (from_user_id, status);
`;

export type OgcodeChallenge = {
  id: string;
  questionId: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "completed";
  createdAt: string;
  attemptedAt: string | null;
  resultScore: number | null;
  resultTime: number | null;
};

type ChallengeRow = {
  id: string;
  question_id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string | Date;
  attempted_at: string | Date | null;
  result_score: number | string | null;
  result_time: number | string | null;
};

function mapRow(row: ChallengeRow): OgcodeChallenge {
  const iso = (v: string | Date | null): string | null =>
    v == null ? null : v instanceof Date ? v.toISOString() : String(v);
  return {
    id: row.id,
    questionId: row.question_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status === "completed" ? "completed" : "pending",
    createdAt: iso(row.created_at) ?? new Date().toISOString(),
    attemptedAt: iso(row.attempted_at),
    resultScore: row.result_score == null ? null : Number(row.result_score),
    resultTime: row.result_time == null ? null : Number(row.result_time),
  };
}

export function isOgcodeChallengesAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function ensureChallengesSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodeChallengesSchemaReady) {
    globalThis.__originOgcodeChallengesSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeChallengesSchemaReady = undefined;
      throw error;
    });
  }
  await globalThis.__originOgcodeChallengesSchemaReady;
}

/**
 * Create a pending challenge. The partial unique index makes a duplicate
 * pending challenge a no-op (ON CONFLICT DO NOTHING) — completed history is
 * unaffected, so a friend can be re-challenged to the same question after they
 * finish the prior one. Returns whether a NEW pending row was created.
 */
export async function createOgcodeChallenge(
  fromUserId: string,
  toUserId: string,
  questionId: string,
): Promise<{ created: boolean }> {
  const pool = getOgcodePostgresPool();
  if (!pool) return { created: false };
  await ensureChallengesSchema();
  const result = await pool.query(
    `INSERT INTO ogcode_friend_challenges (id, question_id, from_user_id, to_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (from_user_id, to_user_id, question_id) WHERE status = 'pending' DO NOTHING`,
    [createId("ogc_chal"), questionId, fromUserId, toUserId],
  );
  return { created: (result.rowCount ?? 0) > 0 };
}

/** Challenges sent TO this user (inbox), newest first, pending before completed. */
export async function listOgcodeChallengeInbox(userId: string, limit = 50): Promise<OgcodeChallenge[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  await ensureChallengesSchema();
  const result = await pool.query<ChallengeRow>(
    `SELECT id, question_id, from_user_id, to_user_id, status, created_at, attempted_at, result_score, result_time
       FROM ogcode_friend_challenges
      WHERE to_user_id = $1
      ORDER BY (status = 'pending') DESC, created_at DESC
      LIMIT $2`,
    [userId, Math.min(Math.max(1, limit), 100)],
  );
  return result.rows.map(mapRow);
}

/** Count of pending challenges for the inbox badge. */
export async function countOgcodePendingChallenges(userId: string): Promise<number> {
  const pool = getOgcodePostgresPool();
  if (!pool) return 0;
  await ensureChallengesSchema();
  const result = await pool.query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM ogcode_friend_challenges WHERE to_user_id = $1 AND status = 'pending'`,
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * On the recipient's terminal outcome, complete any pending challenges they had
 * for this question and return the senders to notify (with each sender's id).
 * Idempotent: only pending rows are touched.
 */
export async function completeOgcodeChallengesForAttempt(
  toUserId: string,
  questionId: string,
  resultScore: number,
  resultTimeSeconds: number,
): Promise<{ fromUserId: string }[]> {
  const pool = getOgcodePostgresPool();
  if (!pool) return [];
  await ensureChallengesSchema();
  const result = await pool.query<{ from_user_id: string }>(
    `UPDATE ogcode_friend_challenges
        SET status = 'completed', attempted_at = NOW(), result_score = $3, result_time = $4
      WHERE to_user_id = $1 AND question_id = $2 AND status = 'pending'
      RETURNING from_user_id`,
    [toUserId, questionId, resultScore, Math.max(0, Math.trunc(resultTimeSeconds))],
  );
  return result.rows.map((row) => ({ fromUserId: row.from_user_id }));
}

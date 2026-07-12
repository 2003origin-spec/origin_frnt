/**
 * OGCode Liked Questions (V1/OGCODE_SCORING_ALGORITHM.md, Part 2 §10).
 *
 * Upvote-only (no dislike). Like COUNT is public (all users); "liked by me" is
 * per-viewer. Sole owner of ogcode_question_likes. The "Liked" list filter is
 * a separate axis (likedByUserId EXISTS clause in the paged catalog query),
 * not a question_type value.
 *
 * Canonical SQL: src/db/migrations/20260713_ogcode_engagement.sql
 */

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";

declare global {
  var __originOgcodeLikesSchemaReady: Promise<void> | undefined;
}

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ogcode_question_likes (
    user_id     TEXT NOT NULL,
    question_id TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, question_id)
  );
  CREATE INDEX IF NOT EXISTS ogcode_question_likes_question_idx ON ogcode_question_likes (question_id);
`;

export type OgcodeLikeInfo = {
  /** Total likes across all users (public). */
  count: number;
  /** Whether the viewing user has liked it. */
  likedByMe: boolean;
};

export function isOgcodeLikesAvailable(): boolean {
  return isOgcodePostgresConfigured();
}

async function ensureLikesSchema(): Promise<void> {
  const pool = getOgcodePostgresPool();
  if (!pool) return;
  if (!globalThis.__originOgcodeLikesSchemaReady) {
    globalThis.__originOgcodeLikesSchemaReady = pool.query(CREATE_TABLE_SQL).then(() => undefined).catch((error) => {
      globalThis.__originOgcodeLikesSchemaReady = undefined;
      throw error;
    });
  }
  await globalThis.__originOgcodeLikesSchemaReady;
}

/** Toggle: like if not liked, unlike if liked. Idempotent per call. */
export async function toggleOgcodeQuestionLike(
  userId: string,
  questionId: string,
): Promise<OgcodeLikeInfo> {
  const pool = getOgcodePostgresPool();
  if (!pool) {
    return { count: 0, likedByMe: false };
  }
  await ensureLikesSchema();

  const deleted = await pool.query(
    `DELETE FROM ogcode_question_likes WHERE user_id = $1 AND question_id = $2`,
    [userId, questionId],
  );
  let likedByMe: boolean;
  if (deleted.rowCount && deleted.rowCount > 0) {
    likedByMe = false;
  } else {
    await pool.query(
      `INSERT INTO ogcode_question_likes (user_id, question_id) VALUES ($1, $2)
       ON CONFLICT (user_id, question_id) DO NOTHING`,
      [userId, questionId],
    );
    likedByMe = true;
  }

  const countResult = await pool.query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM ogcode_question_likes WHERE question_id = $1`,
    [questionId],
  );
  return { count: Number(countResult.rows[0]?.count ?? 0), likedByMe };
}

export async function getOgcodeLikeInfo(userId: string, questionId: string): Promise<OgcodeLikeInfo> {
  const map = await getOgcodeLikeInfoMap(userId, [questionId]);
  return map.get(questionId) ?? { count: 0, likedByMe: false };
}

/** Batch read for list cards: public count + this viewer's liked flag per id. */
export async function getOgcodeLikeInfoMap(
  userId: string,
  questionIds: string[],
): Promise<Map<string, OgcodeLikeInfo>> {
  const ids = [...new Set(questionIds.filter(Boolean))];
  const pool = getOgcodePostgresPool();
  const out = new Map<string, OgcodeLikeInfo>();
  if (!pool || !ids.length) {
    return out;
  }
  await ensureLikesSchema();
  const result = await pool.query<{ question_id: string; count: number | string; liked_by_me: boolean }>(
    `SELECT question_id,
            COUNT(*) AS count,
            BOOL_OR(user_id = $1) AS liked_by_me
       FROM ogcode_question_likes
      WHERE question_id = ANY($2::text[])
      GROUP BY question_id`,
    [userId, ids],
  );
  for (const row of result.rows) {
    out.set(row.question_id, { count: Number(row.count ?? 0), likedByMe: Boolean(row.liked_by_me) });
  }
  return out;
}

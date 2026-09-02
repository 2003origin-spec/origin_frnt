/**
 * Per-question contest discussion (Phase 7). Post-result comments on a contest
 * question. Reading/posting is gated to result-published contests (in the route).
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";

import { ensureContestSchema } from "./contest-schema";

export interface QuestionComment {
  id: string;
  userId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const MAX_BODY = 1000;

export async function listQuestionComments(contestId: string, position: number): Promise<QuestionComment[]> {
  await ensureContestSchema();
  const res = await pool().query<{ id: string; user_id: string; name: string | null; body: string; created_at: string }>(
    `SELECT c.id, c.user_id, u.name, c.body, c.created_at
       FROM contest.question_comments c
       JOIN origin_users u ON u.id = c.user_id
      WHERE c.contest_id = $1 AND c.position = $2
      ORDER BY c.created_at ASC
      LIMIT 200`,
    [contestId, position],
  );
  return res.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    authorName: (r.name || "Anonymous").trim().split(/\s+/)[0],
    body: r.body,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function addQuestionComment(input: {
  contestId: string;
  position: number;
  userId: string;
  body: string;
}): Promise<QuestionComment> {
  await ensureContestSchema();
  const body = input.body.trim().slice(0, MAX_BODY);
  if (!body) {
    const err = new Error("Comment cannot be empty.") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const id = createId("cqc");
  await pool().query(
    `INSERT INTO contest.question_comments (id, contest_id, position, user_id, body)
       VALUES ($1, $2, $3, $4, $5)`,
    [id, input.contestId, input.position, input.userId, body],
  );
  const nameRow = await pool().query<{ name: string | null }>(`SELECT name FROM origin_users WHERE id = $1`, [input.userId]);
  return {
    id,
    userId: input.userId,
    authorName: (nameRow.rows[0]?.name || "Anonymous").trim().split(/\s+/)[0],
    body,
    createdAt: new Date().toISOString(),
  };
}

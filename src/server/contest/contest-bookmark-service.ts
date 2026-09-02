/**
 * Contest question bookmarks (Phase 6). A student saves a question from a
 * finished contest to revisit. The question snapshot is copied from
 * contest.submission_answers so the bookmark is self-contained.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

export interface ContestBookmark {
  contestId: string;
  position: number;
  questionId: string;
  snapshot: Record<string, unknown>;
  note: string | null;
  createdAt: string;
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Toggle a bookmark on one contest question. Returns the new state. */
export async function toggleContestBookmark(input: {
  userId: string;
  contestId: string;
  position: number;
}): Promise<{ bookmarked: boolean }> {
  await ensureContestSchema();
  const existing = await pool().query(
    `SELECT 1 FROM contest.question_bookmarks WHERE user_id = $1 AND contest_id = $2 AND position = $3`,
    [input.userId, input.contestId, input.position],
  );
  if (existing.rows.length > 0) {
    await pool().query(
      `DELETE FROM contest.question_bookmarks WHERE user_id = $1 AND contest_id = $2 AND position = $3`,
      [input.userId, input.contestId, input.position],
    );
    return { bookmarked: false };
  }
  // Copy the question snapshot from the user's own graded answer row.
  const snap = await pool().query<{ question_id: string; question_snapshot: Record<string, unknown> }>(
    `SELECT question_id, question_snapshot FROM contest.submission_answers
       WHERE contest_id = $1 AND user_id = $2 AND position = $3`,
    [input.contestId, input.userId, input.position],
  );
  if (!snap.rows[0]) {
    const err = new Error("Question not found in your attempt.") as Error & { status: number };
    err.status = 404;
    throw err;
  }
  await pool().query(
    `INSERT INTO contest.question_bookmarks (user_id, contest_id, position, question_id, question_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (user_id, contest_id, position) DO NOTHING`,
    [input.userId, input.contestId, input.position, snap.rows[0].question_id, JSON.stringify(snap.rows[0].question_snapshot)],
  );
  return { bookmarked: true };
}

/** The positions this user has bookmarked for one contest (for the review UI). */
export async function listBookmarkedPositions(userId: string, contestId: string): Promise<number[]> {
  await ensureContestSchema();
  const res = await pool().query<{ position: number }>(
    `SELECT position FROM contest.question_bookmarks WHERE user_id = $1 AND contest_id = $2`,
    [userId, contestId],
  );
  return res.rows.map((r) => r.position);
}

/** All of a user's contest bookmarks, newest first (for a "Saved questions" page). */
export async function listUserBookmarks(userId: string, limit = 200): Promise<ContestBookmark[]> {
  await ensureContestSchema();
  const res = await pool().query<{
    contest_id: string; position: number; question_id: string;
    question_snapshot: Record<string, unknown>; note: string | null; created_at: string;
  }>(
    `SELECT contest_id, position, question_id, question_snapshot, note, created_at
       FROM contest.question_bookmarks WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    contestId: r.contest_id,
    position: r.position,
    questionId: r.question_id,
    snapshot: r.question_snapshot,
    note: r.note,
    createdAt: r.created_at,
  }));
}

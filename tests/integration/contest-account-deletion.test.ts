/**
 * DB-backed integration test: account deletion purges a user's transient live
 * contest draft but RETAINS their finalized attempt row (no PII; leaderboard
 * integrity). Plan Phase 0 cross-cutting: contest.* × account-deletion.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { ensureContestSchema } from "@/server/contest/contest-schema";
import { purgeLiveContestStateForUser } from "@/server/contest/contest-account-deletion";

const maybe = dbConfigured() ? test : test.skip;

maybe("account deletion purges the live contest draft, retains the attempt", async () => {
  await ensureContestSchema();
  const pool = rawPool();
  const userId = makeId("user_del");
  const contestId = makeId("contest_del");

  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Del User', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    await pool.query(
      `INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Del Contest', 'scheduled')`,
      [contestId],
    );
    // a live in-progress draft + a finalized attempt for the same user
    await pool.query(
      `INSERT INTO contest.answer_drafts (contest_id, user_id, rev) VALUES ($1, $2, 3)`,
      [contestId, userId],
    );
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, score) VALUES ($1, $2, 42)`,
      [contestId, userId],
    );

    // purge (the hook account-deletion calls)
    await purgeLiveContestStateForUser(userId);

    const draft = await pool.query(
      `SELECT 1 FROM contest.answer_drafts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(draft.rowCount, 0, "live draft is purged");

    const attempt = await pool.query(
      `SELECT score FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(attempt.rowCount, 1, "attempt row is retained");
    assert.equal(Number(attempt.rows[0].score), 42, "attempt data intact");
  } finally {
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  }
});

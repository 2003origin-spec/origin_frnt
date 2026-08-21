/**
 * DB-backed test for contest data retention (Phase 9):
 *   - purgeDrafts drops the answer_drafts partition of a published contest
 *   - archiveOldContests drops submission_answers + flips status once past the
 *     retention window, but ONLY when a leaderboard rollup exists
 *   - a recently-published contest is left untouched
 *   - both passes are idempotent
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  purgeDrafts,
  archiveOldContests,
} from "@/server/contest/contest-retention-service";

const maybe = dbConfigured() ? test : test.skip;

async function partitionExists(pool: ReturnType<typeof rawPool>, base: string, cid: string): Promise<boolean> {
  const r = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('contest.' || contest._partition_name($1, $2)) IS NOT NULL AS exists`,
    [base, cid],
  );
  return r.rows[0]?.exists ?? false;
}

maybe("retention purges drafts, archives past-window contests, spares recent + un-rolled-up", async () => {
  const pool = rawPool();
  // old = published long ago (past the 90d window); recent = just published.
  const oldId = makeId("cret_old");
  const recentId = makeId("cret_recent");
  const noRollupId = makeId("cret_norollup");
  const userId = makeId("u_ret");
  const ids = [oldId, recentId, noRollupId];

  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'R', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );

    for (const id of ids) {
      await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Ret', 'result_published')`, [id]);
      await pool.query(`SELECT contest.ensure_event_partitions($1)`, [id]);
      // a draft + a submission row routed into the per-event partitions
      await pool.query(
        `INSERT INTO contest.answer_drafts (contest_id, user_id) VALUES ($1, $2)`,
        [id, userId],
      );
      await pool.query(
        `INSERT INTO contest.submission_answers (contest_id, user_id, position, question_id, question_snapshot, is_correct)
         VALUES ($1, $2, 0, 'q0', '{}'::jsonb, true)`,
        [id, userId],
      );
    }
    // old + norollup are past the window; recent is fresh.
    await pool.query(`UPDATE contest.contests SET published_at = NOW() - INTERVAL '200 days' WHERE id = ANY($1)`, [[oldId, noRollupId]]);
    await pool.query(`UPDATE contest.contests SET published_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [recentId]);
    // old + recent get a leaderboard rollup; norollup deliberately does not.
    for (const id of [oldId, recentId]) {
      await pool.query(
        `INSERT INTO contest.leaderboard_snapshot (contest_id, rank, user_id, score, percentile)
         VALUES ($1, 1, $2, 10, 99)`,
        [id, userId],
      );
    }

    // ── purgeDrafts ────────────────────────────────────────────────────────
    const purged = await purgeDrafts(50);
    for (const id of ids) {
      assert.ok(purged.includes(id), `drafts purged for ${id}`);
      assert.equal(await partitionExists(pool, "answer_drafts", id), false, `draft partition dropped for ${id}`);
    }
    // idempotent: a second pass purges nothing (marker set)
    const purgedAgain = await purgeDrafts(50);
    for (const id of ids) assert.ok(!purgedAgain.includes(id), `${id} not re-purged`);

    // ── archiveOldContests ─────────────────────────────────────────────────
    const { archived, skipped } = await archiveOldContests(50);
    // old is archived; its submission partition is gone; status flipped.
    assert.ok(archived.includes(oldId), "old contest archived");
    assert.equal(await partitionExists(pool, "submission_answers", oldId), false, "old submissions dropped");
    const oldStatus = await pool.query(`SELECT status, archived_at FROM contest.contests WHERE id = $1`, [oldId]);
    assert.equal(oldStatus.rows[0].status, "archived");
    assert.ok(oldStatus.rows[0].archived_at, "archived_at stamped");
    // recent is within window → untouched, partition intact.
    assert.ok(!archived.includes(recentId), "recent contest not archived");
    assert.equal(await partitionExists(pool, "submission_answers", recentId), true, "recent submissions kept");
    // norollup is past window but has submissions + no leaderboard → skipped, data preserved.
    assert.ok(!archived.includes(noRollupId), "no-rollup contest not archived");
    assert.ok(skipped.some((s) => s.id === noRollupId), "no-rollup contest reported as skipped");
    assert.equal(await partitionExists(pool, "submission_answers", noRollupId), true, "no-rollup submissions preserved");
  } finally {
    for (const id of ids) {
      await pool.query(`SELECT contest.drop_event_partition('answer_drafts', $1)`, [id]);
      await pool.query(`SELECT contest.drop_event_partition('submission_answers', $1)`, [id]);
      await pool.query(`DELETE FROM contest.answer_drafts WHERE contest_id = $1`, [id]);
      await pool.query(`DELETE FROM contest.submission_answers WHERE contest_id = $1`, [id]);
      await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id = $1`, [id]);
      await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [id]);
    }
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  }
});

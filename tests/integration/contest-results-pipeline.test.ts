/**
 * DB-backed test for the results pipeline (Phase 6): an ended contest with all
 * attempts finalized is ranked + published; a contest with an OPEN attempt is
 * NOT published (waits for finalize); re-run is idempotent.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { processEndedContests } from "@/server/contest/contest-results-pipeline";

const maybe = dbConfigured() ? test : test.skip;

async function seedEndedContest(id: string) {
  const now = Date.now();
  await rawPool().query(
    `INSERT INTO contest.contests (id, name, status, start_at, end_at)
     VALUES ($1, 'Pipe', 'scheduled', $2, $3)`,
    [id, new Date(now - 3_600_000).toISOString(), new Date(now - 120_000).toISOString()], // ended 2m ago
  );
}

maybe("pipeline ranks + publishes an ended, fully-finalized contest only", async () => {
  const pool = rawPool();
  const ready = makeId("c_pipe_ok");
  const waiting = makeId("c_pipe_wait");
  const uA = makeId("u_pa");
  const uB = makeId("u_pb");
  const uOpen = makeId("u_open");

  try {
    for (const u of [uA, uB, uOpen]) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'P', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    // READY contest: two finished attempts
    await seedEndedContest(ready);
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at, score, time_taken_seconds, registered_at)
       VALUES ($1,$2, NOW()-INTERVAL '1h', NOW()-INTERVAL '5m', 90, 300, NOW()-INTERVAL '2d'),
              ($1,$3, NOW()-INTERVAL '1h', NOW()-INTERVAL '5m', 80, 200, NOW()-INTERVAL '2d')`,
      [ready, uA, uB],
    );
    // WAITING contest: one still-open attempt → must NOT publish
    await seedEndedContest(waiting);
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at)
       VALUES ($1, $2, NOW()-INTERVAL '1h', NULL)`,
      [waiting, uOpen],
    );

    const res = await processEndedContests();
    assert.ok(res.published.includes(ready), "ready contest published");
    assert.ok(!res.published.includes(waiting), "waiting contest NOT published (open attempt)");

    // ready is result_published with a materialized leaderboard
    const rc = await pool.query(`SELECT status FROM contest.contests WHERE id=$1`, [ready]);
    assert.equal(rc.rows[0].status, "result_published");
    const lb = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [ready]);
    assert.equal(lb.rows[0].n, 2);

    // waiting is still scheduled
    const wc = await pool.query(`SELECT status FROM contest.contests WHERE id=$1`, [waiting]);
    assert.equal(wc.rows[0].status, "scheduled");

    // idempotent: re-run publishes nothing new
    const res2 = await processEndedContests();
    assert.ok(!res2.published.includes(ready));
  } finally {
    for (const c of [ready, waiting]) {
      await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.reminders_sent WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [c]);
    }
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[uA, uB, uOpen]]);
  }
});

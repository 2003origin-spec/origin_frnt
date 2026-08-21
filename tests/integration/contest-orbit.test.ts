/**
 * DB-backed test for the ORBIT rating batch (Phase 7): rates the eligible field
 * from the leaderboard snapshot, seeds first-timers, records history, is
 * idempotent (re-run = no-op), and a top finish out-rates a bottom finish.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getOrbitSummary, rateContest } from "@/server/contest/contest-orbit-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("rateContest rates the field once, idempotently, ordered by percentile", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_orbit");
  const top = makeId("u_top");
  const mid = makeId("u_mid");
  const bot = makeId("u_bot");

  try {
    for (const u of [top, mid, bot]) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'O', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Orbit', 'result_processing')`, [contestId]);
    // a materialized leaderboard: top 100%ile, mid 66%, bottom 33%
    await pool.query(
      `INSERT INTO contest.leaderboard_snapshot (contest_id, rank, user_id, score, time_taken_seconds, percentile)
       VALUES ($1,1,$2,100,200,100), ($1,2,$3,90,220,66.67), ($1,3,$4,80,240,33.33)`,
      [contestId, top, mid, bot],
    );

    const r = await rateContest(contestId);
    assert.equal(r.rated, 3);
    assert.equal(r.skipped, false);

    // all three now have an ORBIT rating (seeded → moved)
    const [tR, mR, bR] = await Promise.all([getOrbitSummary(top), getOrbitSummary(mid), getOrbitSummary(bot)]);
    assert.ok(tR && mR && bR);
    // top finisher out-rates the bottom finisher
    assert.ok(tR!.rating > bR!.rating, `top ${tR!.rating} > bot ${bR!.rating}`);
    // each played exactly one game
    assert.equal(tR!.gamesPlayed, 1);
    // a first contest leaves everyone provisional
    assert.equal(tR!.provisional, true);

    // history recorded for each
    const hist = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    assert.equal(hist.rows[0].n, 3);

    // idempotent: re-run is a no-op, ratings unchanged
    const before = tR!.rating;
    const r2 = await rateContest(contestId);
    assert.equal(r2.skipped, true);
    assert.equal(r2.rated, 0);
    assert.equal((await getOrbitSummary(top))!.rating, before, "re-run doesn't change ratings");
    // still exactly one game played (not double-counted)
    assert.equal((await getOrbitSummary(top))!.gamesPlayed, 1);
  } finally {
    await pool.query(`DELETE FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.orbit_ratings WHERE user_id = ANY($1::text[])`, [[top, mid, bot]]);
    await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[top, mid, bot]]);
  }
});

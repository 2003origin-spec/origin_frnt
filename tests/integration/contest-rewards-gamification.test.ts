/**
 * DB-backed test for Phase 8 reward + gamification: the OGCode reward is awarded
 * once per eligible finisher (idempotent, ledger-guarded, flagged excluded), and
 * gamification writes badges/streak/personal-bests once per contest.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { awardContestRewards } from "@/server/contest/contest-reward-service";
import { applyContestGamification } from "@/server/contest/contest-gamification-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("reward is once-per-eligible-finisher; gamification is idempotent per contest", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_rg");
  const winner = makeId("u_win");
  const flagged = makeId("u_rg_flag");

  try {
    for (const u of [winner, flagged]) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'RG', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, ogcode_reward) VALUES ($1, 'RG', 'result_published', 50)`,
      [contestId],
    );
    // winner: eligible finisher, sharpshooter (12 correct, 0 wrong)
    await pool.query(
      `INSERT INTO contest.attempts
         (contest_id, user_id, started_at, finished_at, score, correct_count, incorrect_count, time_taken_seconds, review_status)
       VALUES ($1, $2, NOW()-INTERVAL '1h', NOW()-INTERVAL '5m', 120, 12, 0, 200, 'none')`,
      [contestId, winner],
    );
    // flagged finisher: NOT eligible → no reward
    await pool.query(
      `INSERT INTO contest.attempts
         (contest_id, user_id, started_at, finished_at, score, correct_count, incorrect_count, time_taken_seconds, review_status)
       VALUES ($1, $2, NOW()-INTERVAL '1h', NOW()-INTERVAL '5m', 200, 15, 0, 100, 'flagged')`,
      [contestId, flagged],
    );
    // leaderboard: only the winner (flagged excluded by ranking)
    await pool.query(
      `INSERT INTO contest.leaderboard_snapshot (contest_id, rank, user_id, score, time_taken_seconds, percentile)
       VALUES ($1, 1, $2, 120, 200, 100)`,
      [contestId, winner],
    );
    // orbit history for the winner (for badge/PB inputs)
    await pool.query(
      `INSERT INTO contest.orbit_history (user_id, contest_id, rating_before, rating_after, rating_change, percentile)
       VALUES ($1, $2, 1000, 1080, 80, 100)`,
      [winner, contestId],
    );

    // REWARD: winner gets 50, flagged gets nothing
    const rw = await awardContestRewards(contestId);
    assert.equal(rw.awarded, 1);
    const ledger = await pool.query(`SELECT user_id, ogcode_points FROM contest.reward_ledger WHERE contest_id=$1`, [contestId]);
    assert.equal(ledger.rowCount, 1);
    assert.equal(ledger.rows[0].user_id, winner);
    assert.equal(ledger.rows[0].ogcode_points, 50);
    // idempotent: re-run awards nothing new
    assert.equal((await awardContestRewards(contestId)).awarded, 0);

    // GAMIFICATION: winner earns sharpshooter (+comeback for +80 orbit), streak=1, PBs set
    const gm = await applyContestGamification(contestId);
    assert.equal(gm.processed, 1);
    const badges = await pool.query(`SELECT badge FROM contest.badges WHERE user_id=$1 ORDER BY badge`, [winner]);
    const badgeSet = badges.rows.map((r) => r.badge);
    assert.ok(badgeSet.includes("sharpshooter"), `badges: ${badgeSet}`);
    assert.ok(badgeSet.includes("comeback"), `badges: ${badgeSet}`);
    const streak = await pool.query(`SELECT current_streak, last_contest_id FROM contest.streaks WHERE user_id=$1`, [winner]);
    assert.equal(streak.rows[0].current_streak, 1);
    const pb = await pool.query(`SELECT highest_orbit, best_rank, best_percentile FROM contest.personal_bests WHERE user_id=$1`, [winner]);
    assert.equal(Number(pb.rows[0].highest_orbit), 1080);
    assert.equal(pb.rows[0].best_rank, 1);

    // idempotent: re-run doesn't advance the streak (same last_contest_id) or dupe badges
    await applyContestGamification(contestId);
    const streak2 = await pool.query(`SELECT current_streak FROM contest.streaks WHERE user_id=$1`, [winner]);
    assert.equal(streak2.rows[0].current_streak, 1, "streak not double-advanced");
    const badges2 = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.badges WHERE user_id=$1`, [winner]);
    assert.equal(badges2.rows[0].n, badgeSet.length, "badges not duplicated");
  } finally {
    await pool.query(`DELETE FROM contest.reward_ledger WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.badges WHERE user_id = ANY($1::text[])`, [[winner, flagged]]);
    await pool.query(`DELETE FROM contest.streaks WHERE user_id = ANY($1::text[])`, [[winner, flagged]]);
    await pool.query(`DELETE FROM contest.personal_bests WHERE user_id = ANY($1::text[])`, [[winner, flagged]]);
    await pool.query(`DELETE FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[winner, flagged]]);
  }
});

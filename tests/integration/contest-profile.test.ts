/**
 * DB-backed test for the contest profile + global ORBIT leaderboard read model.
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getContestProfile, getOrbitLeaderboard } from "@/server/contest/contest-profile-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("profile aggregates ORBIT + history + badges + streak + rewards; leaderboard ranks", async () => {
  const pool = rawPool();
  const uHi = makeId("prof_hi");
  const uLo = makeId("prof_lo");
  const contestId = makeId("prof_c");
  const users = [uHi, uLo];
  try {
    for (const u of users) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'Rahul Verma', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Profile Cup', 'result_published')`, [contestId]);

    // uHi: rating 1500 (non-provisional), uLo: 1100. Both games_played>0, rd<210.
    await pool.query(
      `INSERT INTO contest.orbit_ratings (user_id, current_rating, rd, games_played, highest_rating, rating_change)
       VALUES ($1, 1500, 80, 5, 1520, 30), ($2, 1100, 90, 3, 1150, -10)`,
      [uHi, uLo],
    );
    // history + finished attempt + streak/badge/PB/reward for uHi
    await pool.query(
      `INSERT INTO contest.orbit_history (user_id, contest_id, rating_before, rating_after, rating_change, rank, percentile)
       VALUES ($1, $2, 1470, 1500, 30, 3, 97)`,
      [uHi, contestId],
    );
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at, score)
       VALUES ($1, $2, NOW(), NOW(), 200)`,
      [contestId, uHi],
    );
    await pool.query(`INSERT INTO contest.streaks (user_id, current_streak, longest_streak) VALUES ($1, 3, 4)`, [uHi]);
    await pool.query(`INSERT INTO contest.badges (user_id, badge, contest_id) VALUES ($1, 'sharpshooter', $2)`, [uHi, contestId]);
    await pool.query(`INSERT INTO contest.personal_bests (user_id, highest_orbit, best_rank, best_percentile) VALUES ($1, 1520, 3, 97)`, [uHi]);
    await pool.query(`INSERT INTO contest.reward_ledger (contest_id, user_id, ogcode_points) VALUES ($1, $2, 50)`, [contestId, uHi]);

    // ── profile ──
    const prof = await getContestProfile(uHi);
    assert.equal(prof.orbit?.rating, 1500);
    assert.equal(prof.streak.current, 3);
    assert.equal(prof.streak.longest, 4);
    assert.ok(prof.badges.some((b) => b.badge === "sharpshooter"));
    assert.equal(prof.personalBest?.bestRank, 3);
    assert.equal(prof.totalRewardPoints, 50);
    assert.equal(prof.contestsPlayed, 1);
    assert.equal(prof.history.length, 1);
    assert.equal(prof.history[0].ratingChange, 30);
    assert.equal(prof.history[0].rank, 3);

    // ── leaderboard: uHi ranks above uLo ──
    const lb = await getOrbitLeaderboard({ limit: 100 });
    const hiRow = lb.rows.find((r) => r.userId === uHi);
    const loRow = lb.rows.find((r) => r.userId === uLo);
    assert.ok(hiRow && loRow, "both rated users present");
    assert.ok(hiRow!.rank < loRow!.rank, "higher rating ranks first");
    assert.equal(hiRow!.rating, 1500);
    assert.equal(hiRow!.displayName, "Rahul", "first name only");
  } finally {
    await pool.query(`DELETE FROM contest.reward_ledger WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.personal_bests WHERE user_id = ANY($1::text[])`, [users]);
    await pool.query(`DELETE FROM contest.badges WHERE user_id = ANY($1::text[])`, [users]);
    await pool.query(`DELETE FROM contest.streaks WHERE user_id = ANY($1::text[])`, [users]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.orbit_history WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.orbit_ratings WHERE user_id = ANY($1::text[])`, [users]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [users]);
  }
});

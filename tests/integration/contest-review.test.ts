/**
 * DB-backed test for anti-cheat review (Phase 5): a flagged attempt is excluded
 * from the ranked field + ORBIT; clearing it after publish recomputes and
 * re-includes it; upholding keeps it out.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { rankContest } from "@/server/contest/contest-ranking-service";
import { rateContest } from "@/server/contest/contest-orbit-service";
import { clearFlaggedAttempt, listFlaggedAttempts } from "@/server/contest/contest-review-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("flagged attempt excluded from rank/ORBIT; clear recomputes and re-includes", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_rev");
  const clean = makeId("u_clean");
  const flagged = makeId("u_flag");

  async function seedAttempt(u: string, score: number, review: string) {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'V', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [u, `${u}@test.local`],
    );
    await pool.query(
      `INSERT INTO contest.attempts
         (contest_id, user_id, registered_at, started_at, finished_at, score, time_taken_seconds, review_status, violation_count, eligibility)
       VALUES ($1, $2, NOW()-INTERVAL '2d', NOW()-INTERVAL '1h', NOW()-INTERVAL '5m', $3, 300, $4, $5, $6)`,
      [contestId, u, score, review, review === "flagged" ? 3 : 0, review !== "flagged"],
    );
  }

  try {
    // published contest so review triggers recompute
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Rev', 'result_published')`, [contestId]);
    await seedAttempt(clean, 80, "none");
    await seedAttempt(flagged, 100, "flagged"); // higher score but flagged

    // initial rank/rate: only the clean attempt is eligible
    await rankContest(contestId);
    await rateContest(contestId);

    let lb = await pool.query(`SELECT user_id FROM contest.leaderboard_snapshot WHERE contest_id=$1 ORDER BY rank`, [contestId]);
    assert.deepEqual(lb.rows.map((r) => r.user_id), [clean], "flagged excluded from leaderboard");
    let hist = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    assert.equal(hist.rows[0].n, 1, "only the clean attempt rated");

    // review surface lists the flagged one
    const flags = await listFlaggedAttempts(contestId);
    assert.equal(flags.length, 1);
    assert.equal(flags[0].userId, flagged);

    // clear → recompute re-includes; the (higher-score) cleared attempt now ranks #1
    await clearFlaggedAttempt(contestId, flagged);
    lb = await pool.query(`SELECT user_id, rank FROM contest.leaderboard_snapshot WHERE contest_id=$1 ORDER BY rank`, [contestId]);
    assert.deepEqual(lb.rows.map((r) => r.user_id), [flagged, clean], "cleared attempt re-included at rank 1");
    hist = await pool.query(`SELECT COUNT(*)::int AS n FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    assert.equal(hist.rows[0].n, 2, "both now rated after recompute");

    // the attempt is no longer flagged
    assert.equal((await listFlaggedAttempts(contestId)).length, 0);
  } finally {
    await pool.query(`DELETE FROM contest.orbit_history WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.orbit_ratings WHERE user_id = ANY($1::text[])`, [[clean, flagged]]);
    await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[clean, flagged]]);
  }
});

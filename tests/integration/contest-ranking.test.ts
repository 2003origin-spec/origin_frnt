/**
 * DB-backed test for contest ranking (Phase 6): deterministic total-order
 * tie-break, percentile, eligible-only (flagged/unfinished excluded), idempotent
 * re-run, and keyset paging + personal result.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  getLeaderboardPage,
  getPersonalResult,
  rankContest,
} from "@/server/contest/contest-ranking-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("ranking is deterministic, eligible-only, percentile'd, and keyset-paged", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_rank");
  const base = Date.now() - 86_400_000;
  // users: scores + tie-break inputs designed to exercise every sort column.
  //  A: score 100, time 300
  //  B: score 100, time 300, registered earlier than A  → beats A (reg tiebreak)
  //  C: score 100, time 200                              → beats A/B (time)
  //  D: score  90                                        → below the 100s
  //  E: finished but FLAGGED → excluded
  //  F: NOT finished          → excluded
  const users = {
    A: makeId("u_A"),
    B: makeId("u_B"),
    C: makeId("u_C"),
    D: makeId("u_D"),
    E: makeId("u_E"),
    F: makeId("u_F"),
  };

  async function seedAttempt(
    u: string,
    score: number | null,
    time: number | null,
    regOffsetMs: number,
    finished: boolean,
    review: string,
  ) {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'R', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [u, `${u}@test.local`],
    );
    await pool.query(
      `INSERT INTO contest.attempts
         (contest_id, user_id, registered_at, started_at, finished_at, score, time_taken_seconds, review_status)
       VALUES ($1, $2, $3, $3, $4, $5, $6, $7)`,
      [
        contestId,
        u,
        new Date(base + regOffsetMs).toISOString(),
        finished ? new Date(base + 3_600_000).toISOString() : null,
        score,
        time,
        review,
      ],
    );
  }

  try {
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Rank', 'result_processing')`, [contestId]);
    await seedAttempt(users.A, 100, 300, 5000, true, "none");
    await seedAttempt(users.B, 100, 300, 1000, true, "none"); // earlier reg than A
    await seedAttempt(users.C, 100, 200, 9000, true, "none"); // fastest
    await seedAttempt(users.D, 90, 250, 2000, true, "none");
    await seedAttempt(users.E, 200, 100, 500, true, "flagged"); // excluded despite top score
    await seedAttempt(users.F, 150, 100, 500, false, "none"); // excluded (unfinished)

    const r = await rankContest(contestId);
    assert.equal(r.ranked, 4, "only the 4 eligible attempts ranked");

    // full order via paging
    const page = await getLeaderboardPage(contestId, 0, 50);
    const order = page.rows.map((x) => x.userId);
    assert.deepEqual(order, [users.C, users.B, users.A, users.D], "C(fast) > B(earlier reg) > A > D(lower score)");
    // flagged/unfinished never appear
    assert.ok(!order.includes(users.E) && !order.includes(users.F));

    // rank 1 has the highest percentile; percentile is monotonic non-increasing
    let prev = 101;
    for (const row of page.rows) {
      assert.ok(row.percentile <= prev, "percentile monotonic by rank");
      prev = row.percentile;
    }
    assert.equal(page.rows[0].rank, 1);

    // personal result matches the snapshot
    const bResult = await getPersonalResult(contestId, users.B);
    assert.equal(bResult?.rank, 2);
    assert.equal(bResult?.totalRanked, 4);
    // an excluded user has no personal result
    assert.equal(await getPersonalResult(contestId, users.E), null);

    // idempotent re-run → identical order
    await rankContest(contestId);
    const again = (await getLeaderboardPage(contestId, 0, 50)).rows.map((x) => x.userId);
    assert.deepEqual(again, order, "re-rank is deterministic");

    // keyset paging: page size 2 → two contiguous pages
    const p1 = await getLeaderboardPage(contestId, 0, 2);
    assert.deepEqual(p1.rows.map((x) => x.rank), [1, 2]);
    assert.equal(p1.nextCursor, 2);
    const p2 = await getLeaderboardPage(contestId, p1.nextCursor!, 2);
    assert.deepEqual(p2.rows.map((x) => x.rank), [3, 4]);
    assert.equal(p2.nextCursor, null);
  } finally {
    await pool.query(`DELETE FROM contest.leaderboard_snapshot WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [Object.values(users)]);
  }
});

/**
 * DB-backed test for contest funnel + week-over-week retention analytics.
 * Two consecutive contests with a known player overlap → exact return rate.
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getContestAnalytics } from "@/server/contest/contest-analytics-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("funnel counts + return-next-week cohort are exact", async () => {
  const pool = rawPool();
  const week1 = makeId("cA_w1");
  const week2 = makeId("cA_w2");
  const users = [makeId("uA1"), makeId("uA2"), makeId("uA3"), makeId("uA4")];
  try {
    for (const u of users) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'A', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    // week1 earlier, week2 later (both published)
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at)
       VALUES ($1, 'Week 1', 'result_published', NOW() - INTERVAL '8 days'),
              ($2, 'Week 2', 'result_published', NOW() - INTERVAL '1 day')`,
      [week1, week2],
    );
    // week1: u1,u2,u3 played (u1,u2 submitted); registrations for u1..u4
    for (const u of users) {
      await pool.query(`INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1, $2)`, [week1, u]);
    }
    const playedW1 = [users[0], users[1], users[2]];
    for (const u of playedW1) {
      await pool.query(
        `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at)
         VALUES ($1, $2, NOW(), $3)`,
        [week1, u, u === users[2] ? null : new Date()],
      );
    }
    // week2: u1,u2 returned (played); plus u4 new → overlap with week1 players = 2
    for (const u of [users[0], users[1], users[3]]) {
      await pool.query(
        `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [week2, u],
      );
    }

    const a = await getContestAnalytics();
    const w1 = a.contests.find((c) => c.contestId === week1)!;
    const w2 = a.contests.find((c) => c.contestId === week2)!;
    assert.ok(w1 && w2);

    // week1 funnel
    assert.equal(w1.registered, 4);
    assert.equal(w1.played, 3);
    assert.equal(w1.submitted, 2);
    // 2 of week1's 3 players (u1,u2) returned to week2 → 2/3
    assert.equal(w1.returnedNext, 2);
    assert.ok(w1.returnRate != null && Math.abs(w1.returnRate - 2 / 3) < 1e-9);

    // week2 is the latest → no "next" → return rate null
    assert.equal(w2.returnRate, null);
    assert.equal(w2.played, 3);
  } finally {
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id = ANY($1::text[])`, [[week1, week2]]);
    await pool.query(`DELETE FROM contest.registrations WHERE contest_id = ANY($1::text[])`, [[week1, week2]]);
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [[week1, week2]]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [users]);
  }
});

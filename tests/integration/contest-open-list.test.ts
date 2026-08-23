/**
 * DB-backed test for getOpenContests — proves MULTIPLE simultaneously-hosted
 * contests are all returned (the single-LIMIT bug fix), with correct live/upcoming
 * state, and that ended contests are excluded. Skips without USER_DATABASE_URL.
 */

import test from "node:test";
import assert from "node:assert/strict";

process.env.TEACHER_LAUNCH_CONTEST = "1";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getOpenContests } from "@/server/contest/contest-status";

const maybe = dbConfigured() ? test : test.skip;

maybe("getOpenContests returns ALL open contests (live + upcoming), excludes ended", async () => {
  const pool = rawPool();
  const live = makeId("mc_live");
  const upcoming = makeId("mc_upcoming");
  const ended = makeId("mc_ended");
  const ids = [live, upcoming, ended];
  try {
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at) VALUES
         ($1, 'MC Live',     'scheduled', NOW() - INTERVAL '5 min',  NOW() + INTERVAL '55 min'),
         ($2, 'MC Upcoming', 'scheduled', NOW() + INTERVAL '1 hour', NOW() + INTERVAL '2 hour'),
         ($3, 'MC Ended',    'scheduled', NOW() - INTERVAL '2 hour', NOW() - INTERVAL '1 hour')`,
      ids,
    );

    const list = await getOpenContests(null);
    const mine = list.filter((c) => ids.includes(c.id));

    // Both open contests present; the ended one excluded.
    assert.equal(mine.length, 2, "both open contests returned (multi-host visible)");
    assert.ok(mine.some((c) => c.id === live && c.state === "LIVE"), "live contest present + LIVE");
    assert.ok(mine.some((c) => c.id === upcoming && c.state === "UPCOMING"), "upcoming contest present + UPCOMING");
    assert.ok(!mine.some((c) => c.id === ended), "ended contest excluded");
  } finally {
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [ids]);
  }
});

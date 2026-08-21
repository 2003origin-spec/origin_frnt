/**
 * DB-backed test for listLiveContestIds — the drain cron's "which contests are
 * live right now" query. Seeds contests in several states/windows and asserts
 * only the currently-LIVE one (scheduled + NOW ∈ [start, end+grace)) is returned.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { listLiveContestIds } from "@/server/contest/contest-admin-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("listLiveContestIds returns only currently-live scheduled contests", async () => {
  const pool = rawPool();
  const now = Date.now();
  const ids = {
    live: makeId("contest_live"),
    upcoming: makeId("contest_upcoming"),
    ended: makeId("contest_ended"),
    draft: makeId("contest_draft"),
    published: makeId("contest_published"),
  };

  async function seed(id: string, status: string, startOffsetMs: number, endOffsetMs: number) {
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        `Live-ids ${id}`,
        status,
        new Date(now + startOffsetMs).toISOString(),
        new Date(now + endOffsetMs).toISOString(),
      ],
    );
  }

  try {
    await seed(ids.live, "scheduled", -30 * 60_000, 30 * 60_000); // started 30m ago, ends 30m out
    await seed(ids.upcoming, "scheduled", 60 * 60_000, 120 * 60_000); // starts in 1h
    await seed(ids.ended, "scheduled", -120 * 60_000, -60 * 60_000); // ended 1h ago (past grace)
    await seed(ids.draft, "draft", -30 * 60_000, 30 * 60_000); // in-window but still draft
    await seed(ids.published, "result_published", -30 * 60_000, 30 * 60_000); // already published

    const liveIds = await listLiveContestIds();
    assert.ok(liveIds.includes(ids.live), "the live contest is included");
    assert.ok(!liveIds.includes(ids.upcoming), "upcoming excluded");
    assert.ok(!liveIds.includes(ids.ended), "ended (past grace) excluded");
    assert.ok(!liveIds.includes(ids.draft), "draft excluded");
    assert.ok(!liveIds.includes(ids.published), "published excluded");

    // a contest 10s past end_at is still live within the default 30s grace
    const graceId = makeId("contest_grace");
    await seed(graceId, "scheduled", -60 * 60_000, -10_000); // ended 10s ago
    assert.ok((await listLiveContestIds(30)).includes(graceId), "within grace → still live");
    assert.ok(!(await listLiveContestIds(0)).includes(graceId), "no grace → not live");
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [graceId]);
  } finally {
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [Object.values(ids)]);
  }
});

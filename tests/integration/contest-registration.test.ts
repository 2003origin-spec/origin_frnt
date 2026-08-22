/**
 * DB-backed test for contest registration — the SQL window check (fail-closed,
 * DB NOW()) + idempotency + the authoritative isRegistered read.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  isRegisteredForContest,
  registerForContest,
} from "@/server/contest/contest-registration-service";

const maybe = dbConfigured() ? test : test.skip;

async function seedUser(id: string) {
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
       VALUES ($1, 'Reg', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@test.local`],
  );
}

async function seedContest(id: string, regOpenMs: number, regCloseMs: number, endMs: number) {
  const now = Date.now();
  await rawPool().query(
    `INSERT INTO contest.contests (id, name, status, reg_open, reg_close, start_at, end_at)
     VALUES ($1, 'Reg Contest', 'scheduled', $2, $3, $3, $4)`,
    [
      id,
      new Date(now + regOpenMs).toISOString(),
      new Date(now + regCloseMs).toISOString(),
      new Date(now + endMs).toISOString(),
    ],
  );
}

maybe("registration is window-checked ([reg_open, end_at)), idempotent, readable", async () => {
  const pool = rawPool();
  const userId = makeId("user_reg");
  const walkupId = makeId("user_walkup");
  const openId = makeId("contest_open");
  const liveId = makeId("contest_live");
  const endedId = makeId("contest_ended");

  try {
    await seedUser(userId);
    await seedUser(walkupId);
    // upcoming: reg opened 1d ago, starts in 1h, ends in 2h
    await seedContest(openId, -86_400_000, 3_600_000, 7_200_000);
    // LIVE now: reg opened 1d ago, started 10m ago, ends in 50m
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, reg_open, reg_close, start_at, end_at)
       VALUES ($1, 'Live', 'scheduled', NOW() - INTERVAL '1 day', NOW() - INTERVAL '10 min',
               NOW() - INTERVAL '10 min', NOW() + INTERVAL '50 min')`,
      [liveId],
    );
    // ended: the contest itself is over (end_at 1h ago) → registration closed
    await seedContest(endedId, -7_200_000, -3_900_000, -3_600_000);

    // not registered yet
    assert.equal(await isRegisteredForContest(openId, userId), false);

    // register succeeds (upcoming, within the window)
    const r1 = await registerForContest(openId, userId);
    assert.equal(r1.registered, true);
    assert.equal(r1.alreadyRegistered, false);
    assert.equal(await isRegisteredForContest(openId, userId), true);

    // idempotent: second register is a success, flagged alreadyRegistered
    const r2 = await registerForContest(openId, userId);
    assert.equal(r2.registered, true);
    assert.equal(r2.alreadyRegistered, true);
    assert.equal(r2.registeredAt, r1.registeredAt); // same original timestamp

    // exactly one row
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.registrations WHERE contest_id=$1 AND user_id=$2`,
      [openId, userId],
    );
    assert.equal(count.rows[0].n, 1);

    // LATE REGISTRATION (walk-up): a user can register during a LIVE contest.
    const live = await registerForContest(liveId, walkupId);
    assert.equal(live.registered, true);
    assert.equal(await isRegisteredForContest(liveId, walkupId), true);

    // an ENDED contest rejects (fail-closed — past end_at)
    await assert.rejects(() => registerForContest(endedId, userId), /not open/i);
    assert.equal(await isRegisteredForContest(endedId, userId), false);
  } finally {
    await pool.query(`DELETE FROM contest.registrations WHERE user_id = ANY($1::text[])`, [[userId, walkupId]]);
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [[openId, liveId, endedId]]);
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[userId, walkupId]]);
  }
});

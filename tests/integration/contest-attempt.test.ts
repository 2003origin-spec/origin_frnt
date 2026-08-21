/**
 * DB-backed test for the contest attempt runtime (Phase 3): registration + LIVE
 * gating (fail-closed), single-attempt idempotency (resume), late-entry reduced
 * clock, and the server-authoritative deadline.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getAttemptState, startAttempt } from "@/server/contest/contest-attempt-service";

// Registration closes at start_at, so a LIVE contest can't be registered for
// via the service — late entry (D5a) is a PRE-registered user opening late. The
// tests seed the registration row directly since they target startAttempt.
async function seedRegistration(contestId: string, userId: string) {
  await rawPool().query(
    `INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1, $2)
     ON CONFLICT (contest_id, user_id) DO NOTHING`,
    [contestId, userId],
  );
}

const maybe = dbConfigured() ? test : test.skip;

async function seedUser(id: string) {
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
       VALUES ($1, 'Att', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@test.local`],
  );
}

/** durationMin contest, started `startedAgoMin` ago (negative = not yet started). */
async function seedContest(id: string, startedAgoMin: number, durationMin: number) {
  const now = Date.now();
  const start = new Date(now - startedAgoMin * 60_000);
  const end = new Date(start.getTime() + durationMin * 60_000);
  await rawPool().query(
    `INSERT INTO contest.contests (id, name, status, reg_open, reg_close, start_at, end_at, duration_seconds)
     VALUES ($1, 'Att Contest', 'scheduled', $2, $3, $3, $4, $5)`,
    [id, new Date(now - 86_400_000).toISOString(), start.toISOString(), end.toISOString(), durationMin * 60],
  );
}

maybe("start requires registration then LIVE; resume is idempotent", async () => {
  const pool = rawPool();
  const userId = makeId("user_att");
  const contestId = makeId("contest_att");
  try {
    await seedUser(userId);
    await seedContest(contestId, 10, 60); // started 10m ago, 60m long → LIVE

    // not registered → 403
    await assert.rejects(() => startAttempt(contestId, userId), /Register/i);

    await seedRegistration(contestId, userId);

    // start → attempt created, clock reflects the fixed end_at
    const s1 = await startAttempt(contestId, userId);
    assert.equal(s1.started, true);
    assert.ok(!s1.locked);
    // late entry: started 10m into a 60m contest → ~50m remaining (bounded by end_at)
    assert.ok(s1.remainingSeconds <= 50 * 60 && s1.remainingSeconds > 49 * 60, `remaining ${s1.remainingSeconds}`);

    // resume (idempotent): same started_at, still one row
    const s2 = await startAttempt(contestId, userId);
    assert.equal(s2.startedAt, s1.startedAt);
    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(rows.rows[0].n, 1, "exactly one attempt row");

    // registered_at was denormalized onto the attempt (for the ranking index)
    const denorm = await pool.query(
      `SELECT registered_at FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.ok(denorm.rows[0].registered_at, "registered_at denormalized");
  } finally {
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.registrations WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id=$1`, [userId]);
  }
});

maybe("cannot start before LIVE or after end", async () => {
  const pool = rawPool();
  const userId = makeId("user_att2");
  const upcoming = makeId("contest_up");
  const ended = makeId("contest_end");
  try {
    await seedUser(userId);
    await seedContest(upcoming, -30, 60); // starts in 30m
    await seedContest(ended, 120, 60); // started 120m ago, 60m long → ended
    await seedRegistration(upcoming, userId);
    // registering for an ended contest is itself blocked, so seed the row directly
    await pool.query(`INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1,$2)`, [ended, userId]);

    await assert.rejects(() => startAttempt(upcoming, userId), /not currently live/i);
    await assert.rejects(() => startAttempt(ended, userId), /not currently live/i);

    // no attempt rows were created
    const rows = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.attempts WHERE user_id=$1`,
      [userId],
    );
    assert.equal(rows.rows[0].n, 0);

    // state for a non-started contest reports started:false, full clock
    const st = await getAttemptState(upcoming, userId);
    assert.equal(st.started, false);
  } finally {
    await pool.query(`DELETE FROM contest.registrations WHERE user_id=$1`, [userId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [[upcoming, ended]]);
    await pool.query(`DELETE FROM origin_users WHERE id=$1`, [userId]);
  }
});

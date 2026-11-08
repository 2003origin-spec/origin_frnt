/**
 * G7 — start → submit timing against a real Postgres: the /start row is
 * idempotent (a second /start never moves the clock forward), submit times
 * from it and ignores the client value, consume closes it, and a fresh
 * attempt opens a new row. Old clients (no start) get a clamped value.
 *
 * Skips when OGCODE_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

import {
  consumeAttemptStartQuietly,
  ensureAttemptStartsSchema,
  getOpenAttemptStart,
  recordAttemptStart,
  resolveAttemptTimeTaken,
} from "@/server/attempt-starts";

const url = process.env.OGCODE_DATABASE_URL;
const maybe = url ? test : test.skip;

function makeId(prefix: string) {
  return `${prefix}_test_${Math.random().toString(36).slice(2, 12)}`;
}

maybe("start → submit computes the time server-side and ignores the client", async () => {
  const pool = new Pool({ connectionString: url, max: 2 });
  const userId = makeId("u_g7");
  const testId = makeId("t_g7");
  try {
    await ensureAttemptStartsSchema();

    const first = await recordAttemptStart(userId, "test", testId, 3600);
    const again = await recordAttemptStart(userId, "test", testId, 3600);
    assert.equal(again.startedAt, first.startedAt, "a second /start keeps the first start time");

    // Pretend the student opened the test 4 minutes ago.
    await pool.query(
      `UPDATE analytics.attempt_starts SET started_at = NOW() - INTERVAL '240 seconds'
        WHERE user_id = $1 AND assessment_id = $2`,
      [userId, testId],
    );
    // Re-calling /start just before submitting must not reset the clock.
    await recordAttemptStart(userId, "test", testId, 3600);

    const timing = await resolveAttemptTimeTaken({
      userId,
      kind: "test",
      assessmentId: testId,
      durationSeconds: 3600,
      clientSeconds: 1, // a client claiming it took one second
    });
    assert.equal(timing.source, "server");
    assert.ok(timing.seconds >= 239 && timing.seconds <= 250, `expected ~240 s, got ${timing.seconds}`);
    assert.ok(timing.startId);

    await consumeAttemptStartQuietly(timing.startId, "result_g7_1");
    assert.equal(await getOpenAttemptStart(userId, "test", testId), null, "consumed start is closed");

    // A retake opens a fresh row.
    const retake = await recordAttemptStart(userId, "test", testId, 3600);
    assert.notEqual(retake.startedAt, first.startedAt);

    // Capped at the duration.
    await pool.query(
      `UPDATE analytics.attempt_starts SET started_at = NOW() - INTERVAL '2 hours'
        WHERE user_id = $1 AND assessment_id = $2 AND consumed_result_id IS NULL`,
      [userId, testId],
    );
    const capped = await resolveAttemptTimeTaken({
      userId, kind: "test", assessmentId: testId, durationSeconds: 3600, clientSeconds: 0,
    });
    assert.equal(capped.seconds, 3600);

    // An abandoned start (older than duration + grace) is restarted by /start.
    const restarted = await recordAttemptStart(userId, "test", testId, 3600);
    assert.ok(Date.now() - Date.parse(restarted.startedAt) < 60_000, "stale start was restarted");
  } finally {
    await pool.query(`DELETE FROM analytics.attempt_starts WHERE user_id = $1`, [userId]).catch(() => {});
    await pool.end();
  }
});

maybe("no start row (old client): the client value is clamped and tagged", async () => {
  const userId = makeId("u_g7_old");
  const dppId = makeId("dpp_g7");
  await ensureAttemptStartsSchema();
  const negative = await resolveAttemptTimeTaken({
    userId, kind: "dpp", assessmentId: dppId, durationSeconds: 900, clientSeconds: -500,
  });
  assert.deepEqual(negative, { seconds: 0, source: "client", startId: null });
  const huge = await resolveAttemptTimeTaken({
    userId, kind: "dpp", assessmentId: dppId, durationSeconds: 900, clientSeconds: 1e9,
  });
  assert.deepEqual(huge, { seconds: 900, source: "client", startId: null });
});

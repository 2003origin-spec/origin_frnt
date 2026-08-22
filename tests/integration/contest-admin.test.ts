/**
 * DB-backed integration test for the admin contest builder (Phase 0).
 *
 * Exercises the full lifecycle against real Postgres: create draft → set
 * schedule → publish (freeze questions) → and the guardrails that must reject
 * (publish without a schedule, guess-friendly scoring, edit-after-publish,
 * double-publish). This is the plan's Phase 0 exit criterion "admin creates →
 * schedules → publishes a contest end-to-end".
 *
 * Skips when USER_DATABASE_URL is not configured (safe on a bare dev box).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  cancelContest,
  createContest,
  extendContest,
  getContest,
  publishContest,
  rescheduleContest,
  updateContest,
} from "@/server/contest/contest-admin-service";

const maybe = dbConfigured() ? test : test.skip;

async function seedAdmin(): Promise<string> {
  const id = makeId("user_admin");
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash)
       VALUES ($1, 'Contest Admin', $2, 'admin', 'x')
     ON CONFLICT (id) DO NOTHING`,
    [id, `${id}@test.local`],
  );
  return id;
}

async function cleanup(contestId: string, adminId: string): Promise<void> {
  const pool = rawPool();
  await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
  await pool.query(`DELETE FROM origin_users WHERE id = $1`, [adminId]);
}

maybe("admin contest builder — full create → schedule → publish lifecycle + guardrails", async () => {
  const adminId = await seedAdmin();
  let contestId = "";
  try {
    // 1. create draft
    const draft = await createContest(adminId, {
      name: "Origin Weekly #IntegrationTest",
      subjects: ["Physics", "Chemistry"],
      scoringConfig: { correctMarks: 10, incorrectMarks: 2 },
    });
    contestId = draft.id;
    assert.equal(draft.status, "draft");
    assert.equal(draft.scoringConfig.correctMarks, 10);

    const q = [{ questionId: "qA", subject: "Physics", snapshot: { stem: "P1", answer: "A" }, marks: 4 }];

    // 2. publishing before a schedule is set → rejected
    await assert.rejects(() => publishContest(contestId, q), /required to publish/i);

    // 3. set a valid schedule
    const now = Date.now();
    await updateContest(contestId, {
      regOpen: new Date(now - 5 * 86_400_000).toISOString(),
      regClose: new Date(now + 3_600_000).toISOString(),
      startAt: new Date(now + 3_600_000).toISOString(),
      endAt: new Date(now + 7_200_000).toISOString(),
    });

    // 4. guess-friendly scoring is rejected at publish (anti-guessing guardrail)
    await updateContest(contestId, { scoringConfig: { correctMarks: 3, incorrectMarks: 5 } });
    await assert.rejects(() => publishContest(contestId, q), /strictly more|guessing/i);

    // 5. fix scoring, publish with two questions → freeze
    await updateContest(contestId, { scoringConfig: { correctMarks: 10, incorrectMarks: 2 } });
    const published = await publishContest(contestId, [
      { questionId: "qA", subject: "Physics", snapshot: { stem: "P1", answer: "A" }, marks: 4 },
      { questionId: "qB", subject: "Chemistry", snapshot: { stem: "C1", answer: "B" }, marks: 4 },
    ]);
    assert.equal(published.status, "scheduled");
    assert.equal(published.durationSeconds, 3600);
    assert.ok(published.publishedAt);

    // 6. the paper is frozen, in order
    const frozen = await rawPool().query(
      `SELECT position, question_id FROM contest.contest_questions WHERE contest_id = $1 ORDER BY position`,
      [contestId],
    );
    assert.deepEqual(
      frozen.rows.map((r: { question_id: string }) => r.question_id),
      ["qA", "qB"],
    );

    // 7. edit-after-publish is rejected (paper is frozen)
    await assert.rejects(() => updateContest(contestId, { name: "nope" }), /draft/i);

    // 8. double-publish is rejected
    await assert.rejects(() => publishContest(contestId, q), /already published/i);

    // sanity: re-read reflects the scheduled state
    const reread = await getContest(contestId);
    assert.equal(reread?.status, "scheduled");

    // 9. reschedule while still UPCOMING (start is +1h) → new window applied
    const shifted = await rescheduleContest(contestId, {
      regOpen: new Date(now - 4 * 86_400_000).toISOString(),
      regClose: new Date(now + 2 * 3_600_000).toISOString(),
      startAt: new Date(now + 2 * 3_600_000).toISOString(),
      endAt: new Date(now + 3 * 3_600_000).toISOString(),
    });
    assert.equal(shifted.status, "scheduled");
    assert.equal(shifted.durationSeconds, 3600);
    assert.ok(shifted.startAt && new Date(shifted.startAt).getTime() === now + 2 * 3_600_000);

    // 10. cancel → terminal 'cancelled'
    const cancelled = await cancelContest(contestId);
    assert.equal(cancelled.status, "cancelled");

    // 11. a cancelled contest can't be rescheduled or re-cancelled
    await assert.rejects(
      () =>
        rescheduleContest(contestId, {
          regOpen: new Date(now).toISOString(),
          regClose: new Date(now + 3_600_000).toISOString(),
          startAt: new Date(now + 3_600_000).toISOString(),
          endAt: new Date(now + 7_200_000).toISOString(),
        }),
      /scheduled/i,
    );
    await assert.rejects(() => cancelContest(contestId), /cannot be cancelled/i);
  } finally {
    if (contestId) await cleanup(contestId, adminId);
  }
});

maybe("extendContest bumps end_at for a LIVE contest; refuses an ended one", async () => {
  const adminId = await seedAdmin();
  const pool = rawPool();
  const liveId = makeId("contest_live_ext");
  const endedId = makeId("contest_ended_ext");
  try {
    // LIVE: started 10m ago, ends in 20m
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at, duration_seconds, created_by)
       VALUES ($1, 'Live Ext', 'scheduled', NOW() - INTERVAL '10 min', NOW() + INTERVAL '20 min', 1800, $2)`,
      [liveId, adminId],
    );
    const before = await getContest(liveId);
    const beforeEnd = new Date(before!.endAt!).getTime();

    const after = await extendContest(liveId, 15);
    const afterEnd = new Date(after.endAt!).getTime();
    const deltaMin = Math.round((afterEnd - beforeEnd) / 60000);
    assert.equal(deltaMin, 15, "end_at moved +15 min");
    assert.equal(after.durationSeconds, 1800 + 15 * 60, "duration bumped");

    // ENDED: end_at already in the past → refuse
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at, created_by)
       VALUES ($1, 'Ended Ext', 'scheduled', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', $2)`,
      [endedId, adminId],
    );
    await assert.rejects(() => extendContest(endedId, 10), /already ended/i);
    // bad amount → rejected
    await assert.rejects(() => extendContest(liveId, 0), /between 1 and 180/i);
  } finally {
    await pool.query(`DELETE FROM contest.contests WHERE id = ANY($1::text[])`, [[liveId, endedId]]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [adminId]);
  }
});

/**
 * DB-backed test for the deadline finalize sweep (Phase 4): an abandoned
 * attempt past end_at+grace is auto-submitted (graded from the durable draft),
 * an already-finished attempt is skipped, and a still-live one is left alone.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { sweepExpiredAttempts } from "@/server/contest/contest-finalize-service";
import { saveContestDraft } from "@/server/contest/contest-draft-store";

const maybe = dbConfigured() ? test : test.skip;

async function seedContest(id: string, endedAgoSec: number) {
  const now = Date.now();
  await rawPool().query(
    `INSERT INTO contest.contests (id, name, status, start_at, end_at, duration_seconds, scoring_config)
     VALUES ($1, 'Fin', 'scheduled', $2, $3, 3600, $4::jsonb)`,
    [
      id,
      new Date(now - 3_600_000 - endedAgoSec * 1000).toISOString(),
      new Date(now - endedAgoSec * 1000).toISOString(),
      JSON.stringify({ correctMarks: 10, incorrectMarks: 2, unattemptedMarks: 0 }),
    ],
  );
  await rawPool().query(
    `INSERT INTO contest.contest_questions (contest_id, position, question_id, subject, snapshot)
     VALUES ($1, 0, 'q0', 'Physics', $2::jsonb)`,
    [id, JSON.stringify({ questionType: "mcq", correctOption: 1, options: ["A", "B", "C", "D"] })],
  );
}

maybe("sweep finalizes abandoned expired attempts, skips finished + live", async () => {
  const pool = rawPool();
  const uAbandoned = makeId("u_fin_ab");
  const uFinished = makeId("u_fin_done");
  const cExpired = makeId("c_fin_exp");
  const cLive = makeId("c_fin_live");

  try {
    for (const u of [uAbandoned, uFinished]) {
      await pool.query(
        `INSERT INTO origin_users (id, name, email, role, password_hash)
           VALUES ($1, 'F', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
        [u, `${u}@test.local`],
      );
    }
    await seedContest(cExpired, 120); // ended 2m ago (past grace)

    // an abandoned, unfinished attempt on the expired contest, with a correct draft
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at) VALUES ($1, $2, NOW() - INTERVAL '1 hour')`,
      [cExpired, uAbandoned],
    );
    await saveContestDraft(cExpired, uAbandoned, { answers: { "0": { selectedOption: 1 } }, rev: 1 });

    // an already-finished attempt on the same contest (should be skipped)
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at, finished_at, score)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '5 minutes', 5)`,
      [cExpired, uFinished],
    );

    // a still-LIVE contest with an open attempt (should be left alone)
    const now = Date.now();
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at, duration_seconds)
       VALUES ($1, 'Live', 'scheduled', $2, $3, 3600)`,
      [cLive, new Date(now - 600_000).toISOString(), new Date(now + 3_000_000).toISOString()],
    );
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at) VALUES ($1, $2, NOW() - INTERVAL '5 minutes')`,
      [cLive, uAbandoned],
    );

    const res = await sweepExpiredAttempts();
    assert.equal(res.finalized, 1, "only the abandoned expired attempt is finalized");

    // the abandoned attempt is now finished, graded from its draft (+10 correct)
    const ab = await pool.query(
      `SELECT finished_at, score, finalize_reason, auto_submitted FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [cExpired, uAbandoned],
    );
    assert.ok(ab.rows[0].finished_at);
    assert.equal(Number(ab.rows[0].score), 10);
    assert.equal(ab.rows[0].finalize_reason, "deadline");
    assert.equal(ab.rows[0].auto_submitted, true);

    // the live attempt is untouched
    const live = await pool.query(
      `SELECT finished_at FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [cLive, uAbandoned],
    );
    assert.equal(live.rows[0].finished_at, null, "live attempt left open");

    // re-run is a no-op (idempotent)
    const res2 = await sweepExpiredAttempts();
    assert.equal(res2.finalized, 0);
  } finally {
    for (const c of [cExpired, cLive]) {
      await pool.query(`DELETE FROM contest.submission_answers WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id=$1`, [c]);
      await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [c]);
    }
    await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [[uAbandoned, uFinished]]);
  }
});

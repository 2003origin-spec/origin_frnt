/**
 * DB-backed test for contest submit/finalize idempotency (Phase 4). The
 * load-bearing guarantee: N concurrent submits (manual + auto/sweep + retries)
 * produce EXACTLY ONE graded attempt row and one set of submission_answers, with
 * the count invariant correct+incorrect+unattempted == paper size.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { submitAttempt } from "@/server/contest/contest-submit-service";
import { saveContestDraft } from "@/server/contest/contest-draft-store";

const maybe = dbConfigured() ? test : test.skip;

maybe("concurrent submits grade exactly once; counts and snapshots are consistent", async () => {
  const pool = rawPool();
  const now = Date.now();
  const userId = makeId("user_sub");
  const contestId = makeId("contest_sub");

  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Sub', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, start_at, end_at, duration_seconds, scoring_config)
       VALUES ($1, 'Sub Contest', 'scheduled', $2, $3, 3600, $4::jsonb)`,
      [
        contestId,
        new Date(now - 600_000).toISOString(),
        new Date(now + 3_000_000).toISOString(),
        JSON.stringify({ correctMarks: 10, incorrectMarks: 2, unattemptedMarks: 0 }),
      ],
    );
    // frozen paper: 3 MCQs, correct option = 1
    for (let pos = 0; pos < 3; pos += 1) {
      await pool.query(
        `INSERT INTO contest.contest_questions (contest_id, position, question_id, subject, snapshot)
         VALUES ($1, $2, $3, 'Physics', $4::jsonb)`,
        [contestId, pos, `q${pos}`, JSON.stringify({ questionType: "mcq", correctOption: 1, options: ["A", "B", "C", "D"] })],
      );
    }
    // the attempt (started)
    await pool.query(
      `INSERT INTO contest.attempts (contest_id, user_id, started_at) VALUES ($1, $2, NOW() - INTERVAL '5 minutes')`,
      [contestId, userId],
    );
    // a durable draft: pos0 correct, pos1 wrong, pos2 blank
    await saveContestDraft(contestId, userId, {
      answers: { "0": { selectedOption: 1 }, "1": { selectedOption: 3 } },
      rev: 1,
    });
    // drain into the durable answer_drafts row (submit reads the durable draft)
    // saveContestDraft in the in-memory fallback IS the durable read source in
    // tests, but the service reads via readContestDraft — which uses the same
    // store — so no separate drain is needed here.

    // fire 5 concurrent submits: manual + auto + deadline + 2 retries
    const outcomes = await Promise.all([
      submitAttempt(contestId, userId, "manual"),
      submitAttempt(contestId, userId, "auto"),
      submitAttempt(contestId, userId, "deadline"),
      submitAttempt(contestId, userId, "manual"),
      submitAttempt(contestId, userId, "auto"),
    ]);

    // exactly one graded (alreadySubmitted:false), the rest short-circuit
    const graded = outcomes.filter((o) => !o.alreadySubmitted);
    assert.equal(graded.length, 1, "exactly one submit graded");
    const g = graded[0];
    assert.equal(g.correct, 1);
    assert.equal(g.incorrect, 1);
    assert.equal(g.unattempted, 1);
    assert.equal(g.correct + g.incorrect + g.unattempted, 3, "count invariant");
    assert.equal(g.score, 12); // +10 correct, +2 wrong, 0 blank

    // one attempt row, finished, with the graded summary
    const attempt = await pool.query(
      `SELECT finished_at, score, correct_count, incorrect_count, unattempted_count
         FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(attempt.rowCount, 1);
    assert.ok(attempt.rows[0].finished_at);
    assert.equal(Number(attempt.rows[0].score), 12);
    assert.equal(attempt.rows[0].correct_count, 1);

    // exactly 3 submission_answers (one per position), no dupes
    const snaps = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.submission_answers WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(snaps.rows[0].n, 3);
  } finally {
    await pool.query(`DELETE FROM contest.submission_answers WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.attempts WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id=$1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id=$1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id=$1`, [userId]);
  }
});

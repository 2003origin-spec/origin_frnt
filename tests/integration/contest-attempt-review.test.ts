/**
 * DB-backed test for the post-contest solutions review: gated on published +
 * own attempt; returns each question with the submitted option, correct option,
 * correctness, and explanation from the immutable snapshot.
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getAttemptReview } from "@/server/contest/contest-attempt-review-service";

const maybe = dbConfigured() ? test : test.skip;

maybe("attempt review: gated on publish + own attempt; surfaces answer vs correct + explanation", async () => {
  const pool = rawPool();
  const contestId = makeId("rev_c");
  const userId = makeId("rev_u");
  const snapshot = {
    text: "2 + 2 = ?",
    options: ["3", "4", "5", "6"],
    correctOption: 1,
    explanation: "Basic addition: 2+2=4.",
    subject: "Mathematics",
    chapter: "Arithmetic",
  };
  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'R', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    // not published yet → gate
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Rev Cup', 'scheduled')`, [contestId]);
    await pool.query(
      `INSERT INTO contest.submission_answers
         (contest_id, user_id, position, question_id, question_snapshot, submitted_answer, is_correct, marks_awarded)
       VALUES ($1, $2, 0, 'q0', $3::jsonb, $4::jsonb, false, -2)`,
      [contestId, userId, JSON.stringify(snapshot), JSON.stringify({ selectedOption: 2 })],
    );

    await assert.rejects(() => getAttemptReview(contestId, userId), /published/i);

    // publish → review available
    await pool.query(`UPDATE contest.contests SET status = 'result_published' WHERE id = $1`, [contestId]);
    const rev = await getAttemptReview(contestId, userId);
    assert.equal(rev.contestName, "Rev Cup");
    assert.equal(rev.questions.length, 1);
    const q = rev.questions[0];
    assert.equal(q.submittedOption, 2, "the student's chosen option");
    assert.equal(q.correctOption, 1, "the correct option");
    assert.equal(q.isCorrect, false);
    assert.equal(q.explanation, "Basic addition: 2+2=4.");
    assert.equal(q.subject, "Mathematics");

    // a non-participant (no submission rows) is refused
    await assert.rejects(() => getAttemptReview(contestId, makeId("rev_stranger")), /participants/i);
  } finally {
    await pool.query(`DELETE FROM contest.submission_answers WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
  }
});

/**
 * DB-backed test for pre-contest practice (Phase 2c): registration gate,
 * server-side MCQ grading → per-subject tallies, Prep Score / Accuracy, and
 * ISOLATION from the rated attempt (practice never writes contest.attempts).
 *
 * Skips when USER_DATABASE_URL is not configured. Requires the OGCODE catalog
 * on the same DB (dev deployment shares one physical DB).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  getPracticeMetrics,
  getPracticeQuestions,
  recordPracticeAttempt,
} from "@/server/contest/contest-practice-service";
import { registerForContest } from "@/server/contest/contest-registration-service";

const maybe = dbConfigured() ? test : test.skip;

const SUBJECT = "PhysicsPracticeTest";
const CHAPTER = "PracticeChapter";

maybe("practice grades server-side, tallies per subject, and stays isolated", async () => {
  const pool = rawPool();
  const now = Date.now();
  const userId = makeId("user_prac");
  const contestId = makeId("contest_prac");
  const qCorrectId = makeId("q_prac_ok");
  const qWrongId = makeId("q_prac_no");

  try {
    // seed user + a contest whose reg window is open, scoped to SUBJECT
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'Prac', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    await pool.query(
      `INSERT INTO contest.contests (id, name, status, subjects, topics, reg_open, reg_close, start_at, end_at)
       VALUES ($1, 'Prac Contest', 'scheduled', $2::jsonb, $3::jsonb, $4, $5, $5, $6)`,
      [
        contestId,
        JSON.stringify([SUBJECT]),
        JSON.stringify({ [SUBJECT]: [CHAPTER] }),
        new Date(now - 86_400_000).toISOString(),
        new Date(now + 3_600_000).toISOString(),
        new Date(now + 7_200_000).toISOString(),
      ],
    );
    // two MCQs: correct option is index 1
    for (const [id, idx] of [[qCorrectId, 950101], [qWrongId, 950102]] as const) {
      await pool.query(
        `INSERT INTO ogcode_questions
           (id, source_index, text, explanation, subject, chapter, concept, difficulty,
            question_type, options, correct_option, class)
         VALUES ($1, $2, 'Q', '', $3, $4, 'C', 'medium', 'mcq', $5::jsonb, 1, 11)
         ON CONFLICT (id) DO NOTHING`,
        [id, idx, SUBJECT, CHAPTER, JSON.stringify(["A", "B", "C", "D"])],
      );
    }

    // practice requires registration
    await assert.rejects(() => getPracticeMetrics(contestId, userId), /Register/i);
    await registerForContest(contestId, userId);

    // SUBJECT SELECTION: scoping to the seeded subject returns ONLY that
    // subject's questions (drives the practice subject tabs).
    const scoped = await getPracticeQuestions(contestId, userId, { subject: SUBJECT });
    assert.ok(scoped.items.length > 0, "questions for the selected subject");
    assert.ok(
      scoped.items.every((q) => q.subject.toLowerCase() === SUBJECT.toLowerCase()),
      "the scoped fetch returns only the selected subject",
    );

    // starts at zero
    let m = await getPracticeMetrics(contestId, userId);
    assert.equal(m.attempted, 0);
    assert.equal(m.prepScore, 0);

    // a CORRECT answer (option 1) — feedback + metrics
    let r = await recordPracticeAttempt(contestId, userId, qCorrectId, 1);
    assert.equal(r.isCorrect, true, "correct answer flagged correct");
    assert.equal(r.correctOption, 1, "reveals the correct option");
    assert.equal(r.metrics.attempted, 1);
    assert.equal(r.metrics.correct, 1);
    assert.equal(r.metrics.accuracy, 100);

    // a WRONG answer (option 0 ≠ correct 1) — feedback + metrics
    r = await recordPracticeAttempt(contestId, userId, qWrongId, 0);
    assert.equal(r.isCorrect, false, "wrong answer flagged wrong");
    assert.equal(r.correctOption, 1, "still reveals the correct option");
    m = r.metrics;
    assert.equal(m.attempted, 2);
    assert.equal(m.correct, 1);
    assert.equal(m.accuracy, 50);
    // the subject tally reflects 2 attempted / 1 correct
    const ps = m.perSubject.find((s) => s.subject === SUBJECT);
    assert.ok(ps);
    assert.equal(ps?.attempted, 2);
    assert.equal(ps?.correct, 1);

    // ISOLATION: practice wrote practice_progress, NOT contest.attempts
    const attempts = await pool.query(
      `SELECT COUNT(*)::int AS n FROM contest.attempts WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(attempts.rows[0].n, 0, "practice must not create a rated attempt");
    const prog = await pool.query(
      `SELECT attempted_count, correct_count FROM contest.practice_progress WHERE contest_id=$1 AND user_id=$2`,
      [contestId, userId],
    );
    assert.equal(prog.rows[0].attempted_count, 2);
    assert.equal(prog.rows[0].correct_count, 1);
  } finally {
    await pool.query(`DELETE FROM contest.practice_progress WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.registrations WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM ogcode_questions WHERE chapter = $1`, [CHAPTER]);
  }
});

/**
 * DB-backed test for the custom DPP-from-mistakes (Phase 8c): locked before
 * publish / when not registered / when not premium; unlocked returns fresh
 * weak-chapter questions that EXCLUDE the contest's own question ids.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { getContestMistakeDpp } from "@/server/contest/contest-dpp-service";

const maybe = dbConfigured() ? test : test.skip;

const CHAPTER = "DppWeakChapter";

maybe("custom DPP gates on publish/registration/premium, then excludes contest ids", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_dpp");
  const userId = makeId("u_dpp");
  const contestQId = makeId("q_dpp_contest");
  const freshIds = [makeId("q_dpp_fresh1"), makeId("q_dpp_fresh2")];

  async function seedOgcode(id: string, srcIdx: number) {
    await pool.query(
      `INSERT INTO ogcode_questions
         (id, source_index, text, explanation, subject, chapter, concept, difficulty,
          question_type, options, correct_option, class)
       VALUES ($1, $2, 'Q', '', 'physics', $3, 'C', 'medium', 'mcq', $4::jsonb, 1, 11)
       ON CONFLICT (id) DO NOTHING`,
      [id, srcIdx, CHAPTER, JSON.stringify(["A", "B", "C", "D"])],
    );
  }

  try {
    await pool.query(
      `INSERT INTO origin_users (id, name, email, role, password_hash)
         VALUES ($1, 'D', $2, 'student', 'x') ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    // contest starts as scheduled (not published)
    await pool.query(`INSERT INTO contest.contests (id, name, status) VALUES ($1, 'DPP', 'scheduled')`, [contestId]);
    // the contest's frozen question (to be excluded) + a wrong submission on that chapter
    await seedOgcode(contestQId, 990001);
    await pool.query(
      `INSERT INTO contest.contest_questions (contest_id, position, question_id, subject, snapshot)
       VALUES ($1, 0, $2, 'physics', $3::jsonb)`,
      [contestId, contestQId, JSON.stringify({ questionType: "mcq", chapter: CHAPTER })],
    );
    await pool.query(
      `INSERT INTO contest.submission_answers (contest_id, user_id, position, question_id, question_snapshot, is_correct)
       VALUES ($1, $2, 0, $3, $4::jsonb, false)`,
      [contestId, userId, contestQId, JSON.stringify({ chapter: CHAPTER })],
    );
    // fresh OGCode questions on the same weak chapter
    await seedOgcode(freshIds[0], 990002);
    await seedOgcode(freshIds[1], 990003);

    // 1) not published → locked
    let r = await getContestMistakeDpp(contestId, userId);
    assert.equal(r.locked, true);
    if (r.locked) assert.equal(r.reason, "not_published");

    // publish it
    await pool.query(`UPDATE contest.contests SET status = 'result_published' WHERE id = $1`, [contestId]);

    // 2) published but not registered → locked
    r = await getContestMistakeDpp(contestId, userId);
    assert.equal(r.locked, true);
    if (r.locked) assert.equal(r.reason, "not_registered");

    await pool.query(`INSERT INTO contest.registrations (contest_id, user_id) VALUES ($1, $2)`, [contestId, userId]);

    // 3) registered but not premium → locked
    r = await getContestMistakeDpp(contestId, userId);
    assert.equal(r.locked, true);
    if (r.locked) assert.equal(r.reason, "not_premium");

    // grant premium (admin_comp physics)
    await pool.query(
      `INSERT INTO entitlements.subject_grants (id, user_id, subject, source, status)
       VALUES ($1, $2, 'physics', 'admin_comp', 'active')`,
      [makeId("grant"), userId],
    );

    // 4) unlocked → fresh weak-chapter questions, contest id EXCLUDED
    r = await getContestMistakeDpp(contestId, userId);
    assert.equal(r.locked, false);
    if (!r.locked) {
      assert.ok(r.weakChapters.includes(CHAPTER));
      const ids = r.questions.map((q) => q.id);
      assert.ok(!ids.includes(contestQId), "the contest's own question is excluded");
      assert.ok(ids.includes(freshIds[0]) || ids.includes(freshIds[1]), "fresh questions returned");
    }
  } finally {
    await pool.query(`DELETE FROM entitlements.subject_grants WHERE user_id = $1`, [userId]);
    await pool.query(`DELETE FROM contest.submission_answers WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.registrations WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
    await pool.query(`DELETE FROM origin_users WHERE id = $1`, [userId]);
    await pool.query(`DELETE FROM ogcode_questions WHERE chapter = $1`, [CHAPTER]);
  }
});

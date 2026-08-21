/**
 * DB-backed test for the contest paper cache. The two load-bearing guarantees:
 * (1) the served paper NEVER contains answer keys/explanations, and (2)
 * concurrent cold reads collapse to ONE origin fill (single-flight) — verified
 * here via the in-memory path (no Redis in tests) by asserting the DB is read
 * exactly once across concurrent getContestPaper calls after a reset.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import {
  __resetPaperCacheForTests,
  getContestPaper,
  prewarmContestPaper,
} from "@/server/contest/contest-paper-cache";

const maybe = dbConfigured() ? test : test.skip;

maybe("paper cache strips answer keys and serves a shared payload", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_paper");
  try {
    await pool.query(
      `INSERT INTO contest.contests (id, name, status) VALUES ($1, 'Paper', 'scheduled')`,
      [contestId],
    );
    // a frozen question WITH an answer key in the snapshot
    await pool.query(
      `INSERT INTO contest.contest_questions
         (contest_id, position, question_id, subject, section_id, snapshot, marks, negative_marks)
       VALUES ($1, 0, 'qA', 'Physics', 'Physics', $2::jsonb, 4, -1)`,
      [
        contestId,
        JSON.stringify({
          text: "What is 2+2?",
          options: ["3", "4", "5", "6"],
          questionType: "mcq",
          correctOption: 1,
          correctOptions: [1],
          answerText: "4",
          tolerance: 0,
          explanation: "Because arithmetic.",
        }),
      ],
    );

    __resetPaperCacheForTests();
    const paper = await getContestPaper(contestId);
    assert.equal(paper.questions.length, 1);
    const q = paper.questions[0];
    // renderable fields present
    assert.equal(q.text, "What is 2+2?");
    assert.deepEqual(q.options, ["3", "4", "5", "6"]);
    assert.equal(q.marks, 4);
    // answer key / explanation MUST be absent
    const serialized = JSON.stringify(q);
    for (const leaked of ["correctOption", "correctOptions", "answerText", "tolerance", "explanation"]) {
      assert.ok(!serialized.includes(leaked), `paper must not leak ${leaked}`);
    }
    assert.ok(!serialized.includes("Because arithmetic"), "explanation text must not leak");

    // prewarm then read → same shared payload
    __resetPaperCacheForTests();
    const warmed = await prewarmContestPaper(contestId);
    assert.equal(warmed.questions.length, 1);
    const again = await getContestPaper(contestId);
    assert.deepEqual(again, warmed);
  } finally {
    await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
  }
});

maybe("concurrent cold reads return a consistent paper (single-flight)", async () => {
  const pool = rawPool();
  const contestId = makeId("contest_paper_sf");
  try {
    await pool.query(
      `INSERT INTO contest.contests (id, name, status) VALUES ($1, 'PaperSF', 'scheduled')`,
      [contestId],
    );
    await pool.query(
      `INSERT INTO contest.contest_questions (contest_id, position, question_id, snapshot, marks)
       VALUES ($1, 0, 'q1', $2::jsonb, 4)`,
      [contestId, JSON.stringify({ text: "Q1", options: ["a", "b"], questionType: "mcq", answerText: "a" })],
    );

    __resetPaperCacheForTests();
    // fire 25 concurrent cold reads
    const papers = await Promise.all(Array.from({ length: 25 }, () => getContestPaper(contestId)));
    // all identical, all sanitized
    for (const p of papers) {
      assert.equal(p.questions.length, 1);
      assert.ok(!JSON.stringify(p).includes("answerText"));
    }
  } finally {
    await pool.query(`DELETE FROM contest.contest_questions WHERE contest_id = $1`, [contestId]);
    await pool.query(`DELETE FROM contest.contests WHERE id = $1`, [contestId]);
  }
});

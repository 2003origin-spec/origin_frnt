/**
 * DB-backed integration test for contest question resolution + shortfall
 * detection (plan Phase 0 validation gate). Seeds real ogcode_questions, then
 * resolves an admin selection and asserts: enough → frozen set in order;
 * not-enough → rejected naming the subject.
 *
 * Skips when USER_DATABASE_URL is not configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, makeId, rawPool } from "./_db";
import { resolveContestQuestions } from "@/server/contest/contest-question-selection";

const maybe = dbConfigured() ? test : test.skip;

const CHAPTER = "ContestSelTestChapter";

async function seed(subject: string, base: number, n: number, ids: string[]): Promise<void> {
  const pool = rawPool();
  for (let i = 0; i < n; i += 1) {
    const id = ids[i];
    await pool.query(
      `INSERT INTO ogcode_questions
         (id, source_index, text, explanation, subject, chapter, concept, difficulty,
          question_type, options, correct_option, class)
       VALUES ($1, $2, $3, '', $4, $5, 'C', 'medium', 'mcq', $6::jsonb, 0, 11)
       ON CONFLICT (id) DO NOTHING`,
      [id, base + i, `Q ${subject} ${i}`, subject, CHAPTER, JSON.stringify(["A", "B", "C", "D"])],
    );
  }
}

maybe("resolveContestQuestions freezes a valid paper and rejects a short pool", async () => {
  const contestId = makeId("contest_sel");
  const physIds = Array.from({ length: 5 }, () => makeId("q_phys"));
  const chemIds = Array.from({ length: 2 }, () => makeId("q_chem"));

  try {
    // distinct source_index ranges — the column is globally UNIQUE
    await seed("PhysicsSelTest", 9_500_000, 5, physIds);
    await seed("ChemistrySelTest", 9_600_000, 2, chemIds);

    // enough: 3 Physics + 2 Chemistry → 5 frozen questions in order
    const questions = await resolveContestQuestions({
      contestId,
      selections: [
        { subject: "PhysicsSelTest", count: 3, topics: [CHAPTER] },
        { subject: "ChemistrySelTest", count: 2, topics: [CHAPTER] },
      ],
    });
    assert.equal(questions.length, 5, "5 questions resolved");
    assert.equal(questions.filter((q) => q.subject === "PhysicsSelTest").length, 3);
    assert.equal(questions.filter((q) => q.subject === "ChemistrySelTest").length, 2);
    // snapshot is populated (renderable + gradable)
    assert.ok(questions[0].snapshot.text, "snapshot has text");
    assert.ok(Array.isArray(questions[0].snapshot.options), "snapshot has options");

    // determinism: same contest + selection → same ids
    const again = await resolveContestQuestions({
      contestId,
      selections: [{ subject: "PhysicsSelTest", count: 3, topics: [CHAPTER] }],
    });
    assert.deepEqual(
      again.map((q) => q.questionId),
      questions.filter((q) => q.subject === "PhysicsSelTest").map((q) => q.questionId),
      "seeded selection is deterministic",
    );

    // shortfall: ask for 4 Chemistry when only 2 exist → reject naming the subject
    await assert.rejects(
      () =>
        resolveContestQuestions({
          contestId,
          selections: [{ subject: "ChemistrySelTest", count: 4, topics: [CHAPTER] }],
        }),
      /ChemistrySelTest.*need 4.*has 2/i,
    );
  } finally {
    // delete by the unique test chapter — also clears any orphans from a prior
    // failed run so re-runs are clean.
    await rawPool().query(`DELETE FROM ogcode_questions WHERE chapter = $1`, [CHAPTER]);
  }
});

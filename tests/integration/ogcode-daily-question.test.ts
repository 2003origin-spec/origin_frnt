/**
 * Question of the Day — integration tests against the live OGCode Postgres.
 *
 * Guards the guarantees the feature is defined by:
 *   • exactly one draw per subject per class band per day (four rows today);
 *   • every student in a cohort sees the SAME question;
 *   • a bag never repeats until it is exhausted, then recycles into a new pass;
 *   • the class band scopes the draw (the 9-10 gate);
 *   • the draw is idempotent under concurrency.
 *
 * Skips when OGCODE_DATABASE_URL is not configured. Run:
 *   npx tsx --env-file=.env.local --test tests/integration/ogcode-daily-question.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";

import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";
import { subjectForDay } from "@/lib/qotd-rotation";
import { getOgcodeCatalogQuestionById } from "@/server/ogcode-catalog";
import {
  bagsForBand,
  drawBagForDay,
  getDailyQuestionId,
  runDailyQuestionRollover,
} from "@/server/ogcode-daily-question";

const dbConfigured = Boolean(process.env.OGCODE_DATABASE_URL);

/**
 * Test days live far in the future so a run can never collide with — or
 * overwrite — a real pick for today. The ledger is keyed on the date, so this
 * gives every test its own private slice of it.
 */
const TEST_DATE_PREFIX = "2099";
const day = (n: number) => `2099-01-${String(n).padStart(2, "0")}`;

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.OGCODE_DATABASE_URL, max: 3 });
  }
  return _pool;
}

/** A synthetic subject nothing else in the bank uses, so its bag is ours alone. */
function syntheticSubject(): Subject {
  return `qotd-test-${Math.random().toString(36).slice(2, 10)}` as Subject;
}

/** Seed `count` answerable MCQs into one synthetic subject at `classLevel`. */
async function seedBag(subject: string, count: number, classLevel: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `${subject}-q${i}`;
    ids.push(id);
    await pool().query(
      `INSERT INTO ogcode_questions
         (id, source_index, text, explanation, subject, chapter, concept, difficulty,
          question_type, options, correct_option, class)
       VALUES ($1, $2, $3, '', $4, 'Test Chapter', 'Test Concept', 'medium',
               'mcq', $5::jsonb, 0, $6)
       ON CONFLICT (id) DO NOTHING`,
      [id, 900000 + i, `Synthetic question ${i}`, subject, JSON.stringify(["A", "B", "C", "D"]), classLevel],
    );
  }
  return ids;
}

async function dropBag(subject: string): Promise<void> {
  await pool().query(`DELETE FROM ogcode_questions WHERE subject = $1`, [subject]);
  await pool().query(`DELETE FROM ogcode_daily_subject_questions WHERE subject = $1`, [subject]);
}

async function clearTestDays(): Promise<void> {
  await pool().query(
    `DELETE FROM ogcode_daily_subject_questions WHERE pick_date::text LIKE $1`,
    [`${TEST_DATE_PREFIX}-%`],
  );
}

test("rollover draws exactly one question per subject for the senior band", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  const { draws, skipped } = await runDailyQuestionRollover(day(1), ["senior"]);

  assert.equal(draws.length, ALL_SUBJECTS.length, "one draw per subject");
  assert.deepEqual(
    draws.map((d) => d.subject).sort(),
    [...ALL_SUBJECTS].sort(),
    "every canonical subject is drawn",
  );
  assert.deepEqual(skipped, [], "no senior bag is empty");

  // Each drawn question really belongs to its bag.
  for (const draw of draws) {
    const question = await getOgcodeCatalogQuestionById(draw.questionId);
    assert.ok(question, `${draw.subject} draw resolves to a question`);
    assert.equal(question!.subject, draw.subject, "drawn question is of the bag's subject");
    assert.ok([11, 12].includes(question!.classLevel ?? 0), "drawn question is in the senior band");
    assert.equal(question!.questionType, "mcq", "a Question of the Day is answerable");
  }

  const rows = await pool().query(
    `SELECT count(*)::int AS n FROM ogcode_daily_subject_questions WHERE pick_date = $1`,
    [day(1)],
  );
  assert.equal(rows.rows[0].n, 4, "exactly four rows a day");
  await clearTestDays();
});

test("the junior band draws nothing while the bank is class 11-12 only", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  const { draws, skipped } = await runDailyQuestionRollover(day(2), ["junior"]);
  // This IS the class 9-10 gate: no bag, so no card, with no special case.
  assert.equal(draws.length, 0, "no junior draws");
  assert.equal(skipped.length, ALL_SUBJECTS.length, "every junior bag is empty");
  await clearTestDays();
});

test("rollover is idempotent — a second run returns the same questions", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  const first = await runDailyQuestionRollover(day(3), ["senior"]);
  const second = await runDailyQuestionRollover(day(3), ["senior"]);
  assert.deepEqual(
    second.draws.map((d) => `${d.subject}:${d.questionId}`).sort(),
    first.draws.map((d) => `${d.subject}:${d.questionId}`).sort(),
    "a re-run re-reads rather than re-draws",
  );
  await clearTestDays();
});

test("concurrent first-hits on a bag converge on one question", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  const bag = { band: "senior" as const, subject: "physics" as Subject };
  // Eight callers racing the very first read of a fresh day. ON CONFLICT DO
  // NOTHING + a read-back must leave them all holding the same id, or two
  // students in the same cohort would see different questions.
  const results = await Promise.all(
    Array.from({ length: 8 }, () => drawBagForDay(bag, day(4))),
  );
  const ids = new Set(results.map((r) => r?.questionId));
  assert.equal(ids.size, 1, `all callers agree (got ${[...ids].join(", ")})`);
  await clearTestDays();
});

test("every student in a cohort sees the same question", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  // getDailyQuestionId is the read every student request lands on. It takes no
  // user, by design — the cohort is the only input.
  const bag = { band: "senior" as const, subject: "chemistry" as Subject };
  const studentA = await getDailyQuestionId(bag, day(5));
  const studentB = await getDailyQuestionId(bag, day(5));
  const studentC = await getDailyQuestionId(bag, day(5));
  assert.ok(studentA, "a question was drawn");
  assert.equal(studentB, studentA);
  assert.equal(studentC, studentA);
  await clearTestDays();
});

test("a bag never repeats until exhausted, then recycles into a new pass", { skip: !dbConfigured }, async () => {
  const subject = syntheticSubject();
  const size = 6;
  await seedBag(subject, size, 11);
  try {
    const bag = { band: "senior" as const, subject };

    // Walk the whole bag, one draw a day.
    const firstPass: string[] = [];
    for (let d = 1; d <= size; d += 1) {
      const draw = await drawBagForDay(bag, day(d));
      assert.ok(draw, `day ${d} drew something`);
      assert.equal(draw!.cycle, 1, `day ${d} is still on the first pass`);
      assert.equal(draw!.recycled, false, `day ${d} did not recycle`);
      firstPass.push(draw!.questionId);
    }
    assert.equal(new Set(firstPass).size, size, "no question repeated within the pass");

    // The bag is now empty. The next draw must open a fresh pass.
    const recycleDraw = await drawBagForDay(bag, day(size + 1));
    assert.ok(recycleDraw, "the bag refills rather than going blank");
    assert.equal(recycleDraw!.recycled, true, "the draw is flagged as a recycle");
    assert.equal(recycleDraw!.cycle, 2, "the cycle counter advanced");

    // ...and the new pass is once again non-repeating within itself.
    const secondPass = [recycleDraw!.questionId];
    for (let d = size + 2; d <= size * 2; d += 1) {
      const draw = await drawBagForDay(bag, day(d));
      assert.ok(draw);
      assert.equal(draw!.cycle, 2, `day ${d} is on the second pass`);
      secondPass.push(draw!.questionId);
    }
    assert.equal(new Set(secondPass).size, secondPass.length, "no repeat within the second pass");
  } finally {
    await dropBag(subject);
  }
});

test("the class band scopes the draw", { skip: !dbConfigured }, async () => {
  const subject = syntheticSubject();
  // Class-9 rows only: the senior band must not see them, the junior band must.
  await seedBag(subject, 3, 9);
  try {
    const senior = await drawBagForDay({ band: "senior", subject }, day(1));
    assert.equal(senior, null, "senior band ignores class-9 questions");

    const junior = await drawBagForDay({ band: "junior", subject }, day(1));
    assert.ok(junior, "junior band draws them");
    const question = await getOgcodeCatalogQuestionById(junior!.questionId);
    assert.equal(question!.classLevel, 9);
  } finally {
    await dropBag(subject);
  }
});

test("a cohort's rotation lines up with the day's draws", { skip: !dbConfigured }, async () => {
  await clearTestDays();
  // The end-to-end shape: four draws exist, and a pair cohort alternates between
  // two of them across consecutive days — the same questions everyone else in
  // that cohort gets.
  const cohort: Subject[] = ["physics", "chemistry"];
  const drawsByDay = new Map<number, Map<string, string>>();
  for (const d of [1, 2]) {
    const { draws } = await runDailyQuestionRollover(day(d), ["senior"]);
    drawsByDay.set(d, new Map(draws.map((x) => [x.subject, x.questionId])));
  }

  const dayOneSubject = subjectForDay(cohort, 0);
  const dayTwoSubject = subjectForDay(cohort, 1);
  assert.equal(dayOneSubject, "physics");
  assert.equal(dayTwoSubject, "chemistry");

  const dayOneQuestion = drawsByDay.get(1)!.get(dayOneSubject!);
  const dayTwoQuestion = drawsByDay.get(2)!.get(dayTwoSubject!);
  assert.ok(dayOneQuestion && dayTwoQuestion);
  assert.notEqual(dayOneQuestion, dayTwoQuestion, "different subjects, different questions");

  const q1 = await getOgcodeCatalogQuestionById(dayOneQuestion!);
  const q2 = await getOgcodeCatalogQuestionById(dayTwoQuestion!);
  assert.equal(q1!.subject, "physics");
  assert.equal(q2!.subject, "chemistry");
  await clearTestDays();
});

test("bagsForBand enumerates one bag per canonical subject", { skip: !dbConfigured }, async () => {
  assert.deepEqual(bagsForBand("senior").map((b) => b.subject), [...ALL_SUBJECTS]);
  assert.deepEqual(bagsForBand("junior").map((b) => b.band), ALL_SUBJECTS.map(() => "junior"));
});

test.after(async () => {
  if (!dbConfigured) return;
  await clearTestDays();
  await pool().query(`DELETE FROM ogcode_questions WHERE subject LIKE 'qotd-test-%'`);
  await _pool?.end();
  _pool = null;
});

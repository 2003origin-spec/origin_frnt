/**
 * Per-participant question shuffling (CBT). These are the guards that matter:
 * the permutation must be a permutation (nothing lost/duplicated), stable for a
 * given participant, different across participants, unbiased, and — critically —
 * it must never disturb the canonical `position` that drafts, submissions, and
 * grading are keyed by.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { shuffleQuestionsForParticipant, type ShufflableQuestion } from "@/lib/cbt/shuffle";
import { readShuffleQuestions } from "@/server/cbt/cbt-tests-service";

function makeQuestions(n: number): ShufflableQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ questionId: `q${i}`, position: i }));
}

const TEST_ID = "cbttest_abc";

test("shuffle is a true permutation — same members, same positions, nothing lost", () => {
  const questions = makeQuestions(40);
  const shuffled = shuffleQuestionsForParticipant(questions, "p1", TEST_ID);

  assert.equal(shuffled.length, questions.length);
  assert.deepEqual(
    [...shuffled].map((q) => q.questionId).sort(),
    [...questions].map((q) => q.questionId).sort(),
  );
  // Each question keeps the canonical position it arrived with.
  for (const q of shuffled) {
    assert.equal(q.position, Number(q.questionId.slice(1)));
  }
});

test("shuffle does not mutate the input array", () => {
  const questions = makeQuestions(20);
  const before = questions.map((q) => q.questionId);
  shuffleQuestionsForParticipant(questions, "p1", TEST_ID);
  assert.deepEqual(questions.map((q) => q.questionId), before);
});

test("same participant + test always gets the same order (resume/refresh safety)", () => {
  const questions = makeQuestions(30);
  const first = shuffleQuestionsForParticipant(questions, "p1", TEST_ID).map((q) => q.questionId);
  for (let i = 0; i < 5; i++) {
    const again = shuffleQuestionsForParticipant(questions, "p1", TEST_ID).map((q) => q.questionId);
    assert.deepEqual(again, first);
  }
});

test("different participants get different orders", () => {
  const questions = makeQuestions(30);
  const a = shuffleQuestionsForParticipant(questions, "p1", TEST_ID).map((q) => q.questionId).join(",");
  const b = shuffleQuestionsForParticipant(questions, "p2", TEST_ID).map((q) => q.questionId).join(",");
  const c = shuffleQuestionsForParticipant(questions, "p3", TEST_ID).map((q) => q.questionId).join(",");
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(a, c);
});

test("the same participant gets a different order in a different test", () => {
  const questions = makeQuestions(30);
  const a = shuffleQuestionsForParticipant(questions, "p1", "cbttest_one").map((q) => q.questionId).join(",");
  const b = shuffleQuestionsForParticipant(questions, "p1", "cbttest_two").map((q) => q.questionId).join(",");
  assert.notEqual(a, b);
});

test("removing a question leaves the relative order of the rest intact", () => {
  // A teacher editing a live test must not reshuffle the paper under a student.
  const questions = makeQuestions(25);
  const full = shuffleQuestionsForParticipant(questions, "p1", TEST_ID).map((q) => q.questionId);

  const trimmed = questions.filter((q) => q.questionId !== "q7" && q.questionId !== "q19");
  const after = shuffleQuestionsForParticipant(trimmed, "p1", TEST_ID).map((q) => q.questionId);

  assert.deepEqual(after, full.filter((id) => id !== "q7" && id !== "q19"));
});

test("adding a question does not reorder the existing ones", () => {
  const questions = makeQuestions(20);
  const before = shuffleQuestionsForParticipant(questions, "p1", TEST_ID).map((q) => q.questionId);

  const grown = [...questions, { questionId: "q_new", position: 20 }];
  const after = shuffleQuestionsForParticipant(grown, "p1", TEST_ID).map((q) => q.questionId);

  assert.deepEqual(after.filter((id) => id !== "q_new"), before);
});

test("0- and 1-question lists are handled without error", () => {
  assert.deepEqual(shuffleQuestionsForParticipant([], "p1", TEST_ID), []);
  const one = [{ questionId: "q0", position: 0 }];
  assert.deepEqual(shuffleQuestionsForParticipant(one, "p1", TEST_ID), one);
});

test("shuffle is unbiased — every question reaches every slot roughly equally", () => {
  // Chi-square-ish smoke test: with 5 questions over 5000 participants, each
  // question should land in each of the 5 slots about 1000 times. A biased
  // shuffle (e.g. a modulo-skewed PRNG) blows well past this tolerance.
  const questions = makeQuestions(5);
  const trials = 5000;
  const counts = new Map<string, number[]>(questions.map((q) => [q.questionId, [0, 0, 0, 0, 0]]));

  for (let i = 0; i < trials; i++) {
    const order = shuffleQuestionsForParticipant(questions, `participant_${i}`, TEST_ID);
    order.forEach((q, slot) => {
      counts.get(q.questionId)![slot] += 1;
    });
  }

  const expected = trials / questions.length;
  for (const [questionId, slots] of counts) {
    // Every question must appear exactly once per trial.
    assert.equal(slots.reduce((a, b) => a + b, 0), trials, `${questionId} appeared the wrong number of times`);
    for (let slot = 0; slot < slots.length; slot++) {
      const deviation = Math.abs(slots[slot] - expected) / expected;
      assert.ok(
        deviation < 0.15,
        `${questionId} landed in slot ${slot} ${slots[slot]} times (expected ~${expected}, deviation ${(deviation * 100).toFixed(1)}%)`,
      );
    }
  }
});

test("readShuffleQuestions only trusts an explicit true", () => {
  assert.equal(readShuffleQuestions({ shuffleQuestions: true }), true);
  assert.equal(readShuffleQuestions({ shuffleQuestions: false }), false);
  // Legacy rows and junk values must fall back to authored order.
  assert.equal(readShuffleQuestions({}), false);
  assert.equal(readShuffleQuestions(null), false);
  assert.equal(readShuffleQuestions(undefined), false);
  assert.equal(readShuffleQuestions("true"), false);
  assert.equal(readShuffleQuestions({ shuffleQuestions: "true" }), false);
  assert.equal(readShuffleQuestions({ shuffleQuestions: 1 }), false);
});

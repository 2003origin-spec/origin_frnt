/**
 * Subject-wise Question Load — pure helpers for the Custom Test Builder.
 * No DB, no flags; safe to run anywhere.
 * Plan: V1/SUBJECTWISE_TEST_BUILDER_PLAN.md
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SECONDS_PER_QUESTION,
  MAX_QUESTIONS_PER_SUBJECT,
  MAX_SECONDS_PER_QUESTION,
  MIN_SECONDS_PER_QUESTION,
  clampSecondsPerQuestion,
  clampSubjectCounts,
  computeDurationMinutes,
  resolveEqualCounts,
  totalQuestions,
} from "../../src/lib/subject-test-plan";

test("resolveEqualCounts — JEE keeps every subject equal", () => {
  const counts = resolveEqualCounts(["physics", "chemistry", "mathematics"], 20, "jee");
  assert.deepEqual(counts, { physics: 20, chemistry: 20, mathematics: 20 });
  assert.equal(totalQuestions(counts), 60);
});

test("resolveEqualCounts — NEET doubles Biology only", () => {
  const counts = resolveEqualCounts(["physics", "chemistry", "biology"], 30, "neet");
  assert.deepEqual(counts, { physics: 30, chemistry: 30, biology: 60 });
  assert.equal(totalQuestions(counts), 120);
});

test("resolveEqualCounts — PCMB does NOT double Biology", () => {
  const counts = resolveEqualCounts(["physics", "chemistry", "mathematics", "biology"], 15, "pcmb");
  assert.deepEqual(counts, { physics: 15, chemistry: 15, mathematics: 15, biology: 15 });
});

test("resolveEqualCounts — Biology double is still capped at 500", () => {
  const counts = resolveEqualCounts(["biology"], 300, "neet");
  assert.equal(counts.biology, MAX_QUESTIONS_PER_SUBJECT); // 300*2 → capped to 500
});

test("resolveEqualCounts — loose subject spellings normalise & dedupe", () => {
  const counts = resolveEqualCounts(["Physics", "maths", "mathematics"], 10, "jee");
  assert.deepEqual(counts, { physics: 10, mathematics: 10 });
});

test("clampSubjectCounts — coerces ints, drops junk, caps at 500", () => {
  const counts = clampSubjectCounts({
    physics: 12.7,
    chemistry: 0,
    biology: 501,
    mathematics: -5,
    astrology: 20, // unknown subject → dropped
  });
  assert.deepEqual(counts, { physics: 12, biology: MAX_QUESTIONS_PER_SUBJECT });
});

test("clampSecondsPerQuestion — default / clamp low / clamp high", () => {
  assert.equal(clampSecondsPerQuestion(undefined), DEFAULT_SECONDS_PER_QUESTION);
  assert.equal(clampSecondsPerQuestion(0), DEFAULT_SECONDS_PER_QUESTION);
  assert.equal(clampSecondsPerQuestion(5), MIN_SECONDS_PER_QUESTION);
  assert.equal(clampSecondsPerQuestion(9999), MAX_SECONDS_PER_QUESTION);
  assert.equal(clampSecondsPerQuestion(180), 180);
});

test("computeDurationMinutes — ceil(total × spq / 60)", () => {
  assert.equal(computeDurationMinutes({ physics: 20, chemistry: 20 }, 180), 120); // 40*180/60
  assert.equal(computeDurationMinutes({ physics: 10 }, 120), 20); // 10*120/60
  assert.equal(computeDurationMinutes({ physics: 7 }, 120), 14);
});

test("computeDurationMinutes — zero questions → zero minutes", () => {
  assert.equal(computeDurationMinutes({}, 120), 0);
});

test("totalQuestions — sums the map", () => {
  assert.equal(totalQuestions({ physics: 10, chemistry: 15, biology: 25 }), 50);
});

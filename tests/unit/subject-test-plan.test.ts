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
  MAX_TOTAL_MINUTES,
  EXAM_SUBJECTS,
  clampSecondsPerQuestion,
  clampSubjectCounts,
  computeDurationMinutes,
  computeMaxScore,
  examMode,
  examUnlocked,
  hmsToMinutes,
  secondsToHms,
  formatHms,
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

test("examUnlocked — needs ALL of the exam's subjects", () => {
  assert.equal(examUnlocked("jee", new Set(["physics", "chemistry", "mathematics"])), true);
  assert.equal(examUnlocked("neet", new Set(["physics", "chemistry", "mathematics"])), false);
  assert.equal(examUnlocked("neet", new Set(["physics", "chemistry", "biology"])), true);
  assert.equal(examUnlocked("jee", new Set(["physics", "chemistry", "biology"])), false);
  const all = new Set(["physics", "chemistry", "mathematics", "biology"]);
  assert.equal(examUnlocked("jee", all) && examUnlocked("neet", all), true);
  // Accepts an array too.
  assert.equal(examUnlocked("jee", ["physics", "chemistry", "mathematics"]), true);
});

test("exam ratio — JEE equal, NEET doubles Biology", () => {
  const jee = resolveEqualCounts(EXAM_SUBJECTS.jee, 20, examMode("jee"));
  assert.deepEqual(jee, { physics: 20, chemistry: 20, mathematics: 20 });
  const neet = resolveEqualCounts(EXAM_SUBJECTS.neet, 20, examMode("neet"));
  assert.deepEqual(neet, { physics: 20, chemistry: 20, biology: 40 });
});

test("computeMaxScore — 4 marks per question", () => {
  assert.equal(computeMaxScore({ physics: 20, chemistry: 20, biology: 40 }), 320);
  assert.equal(computeMaxScore({}), 0);
});

test("hmsToMinutes — ceil + clamp", () => {
  assert.equal(hmsToMinutes({ h: 1, m: 30, s: 0 }), 90);
  assert.equal(hmsToMinutes({ h: 0, m: 0, s: 45 }), 1); // ceil up from 45s
  assert.equal(hmsToMinutes({ h: 0, m: 0, s: 0 }), 1); // clamped to MIN
  assert.equal(hmsToMinutes({ h: 99, m: 0, s: 0 }), MAX_TOTAL_MINUTES); // clamped to MAX
});

test("secondsToHms + formatHms round-trip", () => {
  assert.deepEqual(secondsToHms(5445), { h: 1, m: 30, s: 45 });
  assert.equal(formatHms({ h: 1, m: 30, s: 45 }), "01:30:45");
  assert.equal(formatHms(secondsToHms(0)), "00:00:00");
});

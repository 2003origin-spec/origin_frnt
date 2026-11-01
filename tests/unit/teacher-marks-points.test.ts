/**
 * Teacher-set marks are bounded, and are never paid out 1:1 as platform points.
 *
 * Before: `marks` was an unbounded z.number() and a teacher-shared DPP paid
 * `analytics.score` (scored at the teacher's marks) straight into AIR / Hall of
 * Fame — one question at marks 1e9 shared to an alt account = +1e9 points.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TEACHER_MARKS_SCHEMA,
  TEACHER_NEGATIVE_MARKS_SCHEMA,
} from "../../src/lib/assessments/teacher-marks";
import {
  TEACHER_DPP_POINTS_CAP,
  teacherDppPlatformPoints,
  teacherTestPlatformPoints,
} from "../../src/server/teacher-dpp-scoring";

test("correct-answer marks: 0..100, finite", () => {
  for (const ok of [0, 1, 4, 3.5, 100]) assert.equal(TEACHER_MARKS_SCHEMA.safeParse(ok).success, true, String(ok));
  for (const bad of [-1, 100.5, 1e9, Infinity, Number.NaN]) {
    assert.equal(TEACHER_MARKS_SCHEMA.safeParse(bad).success, false, String(bad));
  }
});

test("negative marks: magnitude ≤ 100, either sign (UIs send a positive magnitude)", () => {
  for (const ok of [-1, 1, 0, -2, -100, 100]) {
    assert.equal(TEACHER_NEGATIVE_MARKS_SCHEMA.safeParse(ok).success, true, String(ok));
  }
  for (const bad of [-101, 101, -1e9, -Infinity]) {
    assert.equal(TEACHER_NEGATIVE_MARKS_SCHEMA.safeParse(bad).success, false, String(bad));
  }
});

test("teacher DPP platform points: percentage of the auto-DPP ceiling", () => {
  assert.equal(TEACHER_DPP_POINTS_CAP, 40); // 10 questions × +4, an auto DPP's maximum
  assert.equal(teacherDppPlatformPoints(1e9, 1e9), 40); // the 1e9-marks exploit pays the cap, not 1e9
  assert.equal(teacherDppPlatformPoints(14, 28), 20);
  assert.equal(teacherDppPlatformPoints(0, 28), 0);
  assert.equal(teacherDppPlatformPoints(-7, 28), 0);
  assert.equal(teacherDppPlatformPoints(5, 0), 0); // all-zero paper has no percentage
  assert.equal(teacherDppPlatformPoints(Number.NaN, 10), 0);
});

test("teacher-assigned test platform points: percentage of what a platform test of that length pays", () => {
  // A platform test pays +4 per correct answer, so a 50-question paper tops
  // out at 200. The teacher's 50 × 100-mark paper used to pay 5 000.
  assert.equal(teacherTestPlatformPoints(5000, 5000, 50), 200);
  assert.equal(teacherTestPlatformPoints(2500, 5000, 50), 100);
  assert.equal(teacherTestPlatformPoints(1e9, 1e9, 1), 4);
  assert.equal(teacherTestPlatformPoints(3, 4, 1), 3); // +3 on a +4 question: 75% of 4
  assert.equal(teacherTestPlatformPoints(0, 100, 10), 0);
  assert.equal(teacherTestPlatformPoints(-20, 100, 10), 0);
  assert.equal(teacherTestPlatformPoints(10, 0, 10), 0); // all-zero paper has no percentage
  assert.equal(teacherTestPlatformPoints(10, 10, 0), 0); // no questions, no cap
  assert.equal(teacherTestPlatformPoints(10, 10, Number.NaN), 0);
  // Never more than the percentage-scaled cap, even when the score overshoots.
  assert.equal(teacherTestPlatformPoints(200, 100, 10), 40);
});

test("both teacher test routes use the bounded marks schemas", () => {
  for (const route of [
    "app/api/teacher/workspaces/[workspaceId]/tests/route.ts",
    "app/api/teacher/workspaces/[workspaceId]/tests/[testId]/route.ts",
  ]) {
    const src = readFileSync(new URL(`../../src/${route}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /marks: z\.number\(\)/i, route);
    assert.match(src, /marks: TEACHER_MARKS_SCHEMA/, route);
    assert.match(src, /negativeMarks: TEACHER_NEGATIVE_MARKS_SCHEMA/, route);
  }
});

test("test submit pays normalised points for teacher-assigned tests only", () => {
  const src = readFileSync(new URL("../../src/legacy/assessments.ts", import.meta.url), "utf8");
  const submit = src.slice(src.indexOf("export async function submitTest"));
  const body = submit.slice(0, submit.indexOf("\nexport "));
  // Persisted path: the cohort tag (batch assignment or teacher room) selects the rule.
  assert.match(body, /teacherCohort\s*\?\s*teacherTestPlatformPoints\(analytics\.score, analytics\.totalMarks, questionCount\)\s*:\s*analytics\.score/);
  assert.match(body, /awardPoints\(store, user\.id, platformPoints, "practice"/);
  assert.doesNotMatch(body, /awardPoints\(store, user\.id, analytics\.score, "practice"/);
  // The claimed award is the normalised amount, not the teacher's raw marks.
  assert.match(body, /claimPointAward\(\s*user\.id,\s*assessmentAwardKey\("test", testId\),\s*platformPoints,/);
  // Degraded fallback path: the attempt was not persisted, so there is no
  // durable first-attempt claim and it pays no points at all (G6) — teacher or not.
  const local = src.slice(src.indexOf("function buildLocalSubmittedTestResult"));
  const localBody = local.slice(0, local.indexOf("\nexport "));
  assert.doesNotMatch(localBody, /awardPoints\(/);
});

test("DPP submit pays normalised points for teacher-shared DPPs", () => {
  const src = readFileSync(new URL("../../src/legacy/assessments.ts", import.meta.url), "utf8");
  const submit = src.slice(src.indexOf("export async function submitGeneratedDpp"));
  const body = submit.slice(0, submit.indexOf("\nexport "));
  assert.match(body, /scoringOverrides\s*\?\s*teacherDppPlatformPoints\(analytics\.score, analytics\.totalMarks\)/);
  assert.match(body, /awardPoints\(store, user\.id, platformPoints, "dpp"/);
  assert.doesNotMatch(body, /awardPoints\(store, user\.id, analytics\.score, "dpp"/);
});

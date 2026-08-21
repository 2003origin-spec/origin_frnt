/**
 * Contest scoring-config + schedule validation unit tests (Phase 0). Pure, no DB.
 *
 * The load-bearing guards: the anti-guessing rule (correct >> incorrect) can
 * never be satisfied by a config where guessing pays, and a schedule can only
 * publish when its four instants are present and correctly ordered.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONTEST_SCORING,
  MIN_CORRECT_TO_INCORRECT_RATIO,
  durationSeconds,
  normalizeScoringConfig,
  validateSchedule,
  validateScoringConfig,
} from "@/lib/contest/contest-config";

test("default scoring is the PRD proposal and passes the guardrail", () => {
  assert.equal(DEFAULT_CONTEST_SCORING.correctMarks, 10);
  assert.equal(DEFAULT_CONTEST_SCORING.incorrectMarks, 2);
  assert.equal(DEFAULT_CONTEST_SCORING.unattemptedMarks, 0);
  assert.deepEqual(validateScoringConfig(DEFAULT_CONTEST_SCORING), { ok: true });
});

test("normalizeScoringConfig fills missing/invalid fields from the default", () => {
  const n = normalizeScoringConfig({ correctMarks: 8, difficultyMultiplier: true });
  assert.equal(n.correctMarks, 8);
  assert.equal(n.incorrectMarks, DEFAULT_CONTEST_SCORING.incorrectMarks); // filled
  assert.equal(n.difficultyMultiplier, true);
  assert.equal(n.partialCreditPolicy, "fractional");
  // garbage inputs fall back
  const g = normalizeScoringConfig({ correctMarks: "x", incorrectMarks: NaN });
  assert.equal(g.correctMarks, DEFAULT_CONTEST_SCORING.correctMarks);
  assert.equal(g.incorrectMarks, DEFAULT_CONTEST_SCORING.incorrectMarks);
  // non-object input
  assert.deepEqual(normalizeScoringConfig(null), DEFAULT_CONTEST_SCORING);
});

test("anti-guessing: correct must be > 0", () => {
  const r = validateScoringConfig(normalizeScoringConfig({ correctMarks: 0, incorrectMarks: 0 }));
  assert.equal(r.ok, false);
});

test("anti-guessing: correct must be strictly greater than incorrect", () => {
  const r = validateScoringConfig(normalizeScoringConfig({ correctMarks: 5, incorrectMarks: 5 }));
  assert.equal(r.ok, false);
});

test("anti-guessing: positive incorrect marks must be ≤ correct / ratio", () => {
  // correct 6, incorrect 4 → ratio 1.5× < 2×  → rejected
  assert.equal(validateScoringConfig(normalizeScoringConfig({ correctMarks: 6, incorrectMarks: 4 })).ok, false);
  // correct 10, incorrect 5 → exactly 2× → accepted
  assert.equal(validateScoringConfig(normalizeScoringConfig({ correctMarks: 10, incorrectMarks: 5 })).ok, true);
  // sanity: the constant is what we test against
  assert.equal(MIN_CORRECT_TO_INCORRECT_RATIO, 2);
});

test("negative marking is allowed (guess-suppressing) regardless of ratio", () => {
  // exam-style +4 / -1 → incorrect is negative, ratio rule doesn't apply
  const r = validateScoringConfig(normalizeScoringConfig({ correctMarks: 4, incorrectMarks: -1 }));
  assert.deepEqual(r, { ok: true });
});

const D = (iso: string) => new Date(iso);
const OK_SCHED = {
  regOpen: D("2026-08-20T00:00:00Z"),
  regClose: D("2026-08-25T13:00:00Z"),
  startAt: D("2026-08-25T13:00:00Z"),
  endAt: D("2026-08-25T14:00:00Z"),
};

test("valid schedule (reg_open < reg_close ≤ start < end) passes", () => {
  assert.deepEqual(validateSchedule(OK_SCHED), { ok: true });
});

test("schedule requires all four instants to publish", () => {
  assert.equal(validateSchedule({ ...OK_SCHED, endAt: null }).ok, false);
  assert.equal(validateSchedule({ ...OK_SCHED, regOpen: null }).ok, false);
});

test("schedule rejects bad ordering", () => {
  // reg_open after reg_close
  assert.equal(
    validateSchedule({ ...OK_SCHED, regOpen: D("2026-08-26T00:00:00Z") }).ok,
    false,
  );
  // reg_close after start
  assert.equal(
    validateSchedule({ ...OK_SCHED, regClose: D("2026-08-25T13:30:00Z") }).ok,
    false,
  );
  // start not before end (zero-length)
  assert.equal(
    validateSchedule({ ...OK_SCHED, endAt: D("2026-08-25T13:00:00Z") }).ok,
    false,
  );
});

test("durationSeconds is end − start in whole seconds, 0 when unset/invalid", () => {
  assert.equal(durationSeconds(OK_SCHED.startAt, OK_SCHED.endAt), 3600);
  assert.equal(durationSeconds(null, OK_SCHED.endAt), 0);
  assert.equal(durationSeconds(OK_SCHED.endAt, OK_SCHED.startAt), 0); // negative → 0
});

/**
 * Per-question timing (CBT report cards). The guards that matter: seconds are
 * counted in exactly one place (never double-counted across a navigate →
 * autosave → close sequence), the clock stops while the student isn't there,
 * a resume continues rather than restarts, a stale write can never REDUCE a
 * recorded time, and nothing can exceed the room duration.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  QuestionTimer,
  mergeQuestionTimes,
  sanitizeQuestionTimes,
  totalQuestionTime,
} from "@/lib/cbt/question-timing";

const CAP = 3600; // a 60-minute paper

test("a segment banks its elapsed seconds on the position that was open", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(0, 0);
  timer.close(12_000);
  assert.deepEqual(timer.snapshot(99_000), { 0: 12 });
});

test("snapshot includes the running segment but close() still counts it once", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(3, 0);

  // Mid-question autosave sees the truth…
  assert.deepEqual(timer.snapshot(10_000), { 3: 10 });
  // …and it is NOT banked yet, so closing later totals from the segment start,
  // not from the snapshot (this is the double-count the design has to avoid).
  timer.close(20_000);
  assert.deepEqual(timer.snapshot(20_000), { 3: 20 });
});

test("navigating between questions accumulates per position", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(0, 0);
  timer.open(1, 5_000); // 5s on q0
  timer.open(0, 11_000); // 6s on q1
  timer.close(15_000); // +4s on q0
  assert.deepEqual(timer.snapshot(15_000), { 0: 9, 1: 6 });
});

test("close() is idempotent — a second call adds nothing", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(2, 0);
  timer.close(8_000);
  timer.close(60_000);
  assert.deepEqual(timer.snapshot(60_000), { 2: 8 });
});

test("a paused stretch (hidden tab / offline) accrues no time", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(0, 0);
  timer.close(4_000); // student backgrounds the app at t=4s
  // ...20 minutes of no network...
  timer.open(0, 1_204_000); // comes back
  timer.close(1_210_000);
  assert.deepEqual(timer.snapshot(1_210_000), { 0: 10 });
  assert.equal(timer.active, null);
});

test("sub-second flicks are ignored (navigation, not reading)", () => {
  const timer = new QuestionTimer({}, CAP);
  timer.open(0, 0);
  timer.open(1, 400);
  timer.close(900);
  assert.deepEqual(timer.snapshot(900), {});
});

test("resume hydrates from the server and keeps counting from there", () => {
  const timer = new QuestionTimer({ 0: 30, 1: 45 }, CAP);
  timer.open(0, 0);
  timer.close(10_000);
  assert.deepEqual(timer.snapshot(10_000), { 0: 40, 1: 45 });
});

test("hydrate() never loses seconds counted on this device", () => {
  const timer = new QuestionTimer({ 0: 10 }, CAP);
  timer.open(0, 0);
  timer.close(50_000); // now 60 locally
  timer.hydrate({ 0: 25, 4: 12 }); // an older server copy arrives
  assert.deepEqual(timer.snapshot(50_000), { 0: 60, 4: 12 });
});

test("no position can exceed the room duration", () => {
  const timer = new QuestionTimer({}, 60);
  timer.open(0, 0);
  timer.close(10_000_000);
  assert.deepEqual(timer.snapshot(10_000_000), { 0: 60 });
});

test("merge takes the max per position, never the sum", () => {
  // Both sides are cumulative totals for the SAME attempt, so summing would
  // double-count every second the two devices agree on.
  assert.deepEqual(mergeQuestionTimes({ 0: 30, 1: 10 }, { 0: 20, 2: 5 }, CAP), { 0: 30, 1: 10, 2: 5 });
});

test("merge cannot be used to reduce a recorded time", () => {
  // A late sendBeacon from a dying tab carrying stale, smaller numbers.
  assert.deepEqual(mergeQuestionTimes({ 0: 90 }, { 0: 5 }, CAP), { 0: 90 });
});

test("merge tolerates null/undefined on either side", () => {
  assert.deepEqual(mergeQuestionTimes(null, { 1: 4 }, CAP), { 1: 4 });
  assert.deepEqual(mergeQuestionTimes({ 1: 4 }, undefined, CAP), { 1: 4 });
  assert.deepEqual(mergeQuestionTimes(null, null, CAP), {});
});

test("sanitize drops junk a hand-crafted payload could carry", () => {
  const dirty = {
    "0": 30,
    "-1": 50, // negative position
    abc: 10, // non-numeric key
    "2": -5, // negative seconds
    "3": "nonsense", // non-numeric value
    "4": Number.NaN,
    "5": Number.POSITIVE_INFINITY,
    "6": 999_999, // beyond the cap
  } as unknown;
  assert.deepEqual(sanitizeQuestionTimes(dirty, CAP), { 0: 30, 6: CAP });
});

test("sanitize rejects non-objects outright", () => {
  assert.deepEqual(sanitizeQuestionTimes(null, CAP), {});
  assert.deepEqual(sanitizeQuestionTimes("nope", CAP), {});
  assert.deepEqual(sanitizeQuestionTimes([1, 2, 3], CAP), {});
});

test("totalQuestionTime sums the accounted seconds", () => {
  assert.equal(totalQuestionTime({ 0: 30, 1: 45, 2: 0 }), 75);
  assert.equal(totalQuestionTime(null), 0);
});

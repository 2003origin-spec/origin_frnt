/**
 * Teacher-assigned test window rules (src/lib/assessments/test-window.ts).
 * The server gate in src/legacy/assessments.ts is a thin wrapper over these.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TEST_WINDOW_SUBMIT_GRACE_SECONDS,
  TestWindowError,
  canContinueTeacherTest,
  cappedSittingSeconds,
  earliestDeadline,
  isTestWindowError,
  testWindowErrorStatus,
  testWindowPhase,
  windowDeadlineOnClientClock,
} from "@/lib/assessments/test-window";

// Sunday 10:00-13:00 IST = 04:30-07:30 UTC.
const START = "2026-10-25T04:30:00.000Z";
const END = "2026-10-25T07:30:00.000Z";
const WINDOW = { startsAt: START, endsAt: END };
const at = (iso: string) => new Date(iso);
const plusSeconds = (iso: string, s: number) => new Date(new Date(iso).getTime() + s * 1000);

test("phase: upcoming before start, open inside (bounds inclusive), ended after end", () => {
  assert.equal(testWindowPhase(WINDOW, at("2026-10-23T15:00:00.000Z")), "upcoming");
  assert.equal(testWindowPhase(WINDOW, plusSeconds(START, -1)), "upcoming");
  assert.equal(testWindowPhase(WINDOW, at(START)), "open");
  assert.equal(testWindowPhase(WINDOW, at("2026-10-25T06:00:00.000Z")), "open");
  assert.equal(testWindowPhase(WINDOW, at(END)), "open");
  assert.equal(testWindowPhase(WINDOW, plusSeconds(END, 1)), "ended");
});

test("phase: null bounds are unbounded (an assignment with no window is always open)", () => {
  assert.equal(testWindowPhase({ startsAt: null, endsAt: null }, at("2030-01-01T00:00:00Z")), "open");
  assert.equal(testWindowPhase({ startsAt: null, endsAt: END }, at("2020-01-01T00:00:00Z")), "open");
  assert.equal(testWindowPhase({ startsAt: START, endsAt: null }, at("2030-01-01T00:00:00Z")), "open");
  assert.equal(testWindowPhase({ startsAt: undefined, endsAt: "" }, at("2030-01-01T00:00:00Z")), "open");
});

test("before start: refused as test_not_started (403), even with a recorded attempt", () => {
  const d = canContinueTeacherTest({ window: WINDOW, attemptStartedAt: null, now: plusSeconds(START, -60) });
  assert.deepEqual(d, { ok: false, phase: "upcoming", code: "test_not_started" });
  assert.equal(testWindowErrorStatus("test_not_started"), 403);
});

test("inside the window: accepted with or without an attempt row", () => {
  assert.deepEqual(
    canContinueTeacherTest({ window: WINDOW, attemptStartedAt: null, now: at("2026-10-25T05:00:00Z") }),
    { ok: true, phase: "open", inGrace: false },
  );
});

test("after end: a submit for an attempt started inside the window lands within the grace", () => {
  const startedAt = "2026-10-25T07:00:00.000Z";
  const justAfter = canContinueTeacherTest({ window: WINDOW, attemptStartedAt: startedAt, now: plusSeconds(END, 30) });
  assert.deepEqual(justAfter, { ok: true, phase: "ended", inGrace: true });

  const atGraceEdge = canContinueTeacherTest({
    window: WINDOW,
    attemptStartedAt: startedAt,
    now: plusSeconds(END, TEST_WINDOW_SUBMIT_GRACE_SECONDS),
  });
  assert.equal(atGraceEdge.ok, true);

  const pastGrace = canContinueTeacherTest({
    window: WINDOW,
    attemptStartedAt: startedAt,
    now: plusSeconds(END, TEST_WINDOW_SUBMIT_GRACE_SECONDS + 1),
  });
  assert.deepEqual(pastGrace, { ok: false, phase: "ended", code: "test_ended" });
  assert.equal(testWindowErrorStatus("test_ended"), 409);
});

test("after end: no grace without an attempt started inside the window", () => {
  // No recorded attempt → no new attempt after the bell.
  assert.equal(
    canContinueTeacherTest({ window: WINDOW, attemptStartedAt: null, now: plusSeconds(END, 5) }).ok,
    false,
  );
  // An attempt started BEFORE the window opened (should never happen, but must not earn grace).
  assert.equal(
    canContinueTeacherTest({ window: WINDOW, attemptStartedAt: plusSeconds(START, -10), now: plusSeconds(END, 5) }).ok,
    false,
  );
  // An attempt "started" after the end (clock skew / forged) earns nothing.
  assert.equal(
    canContinueTeacherTest({ window: WINDOW, attemptStartedAt: plusSeconds(END, 1), now: plusSeconds(END, 5) }).ok,
    false,
  );
});

test("grace is 60 s and configurable per call", () => {
  assert.equal(TEST_WINDOW_SUBMIT_GRACE_SECONDS, 60);
  const d = canContinueTeacherTest({
    window: WINDOW,
    attemptStartedAt: START,
    now: plusSeconds(END, 10),
    graceSeconds: 5,
  });
  assert.equal(d.ok, false);
});

test("TestWindowError carries status/code/window and is recognised structurally", () => {
  const err = new TestWindowError("test_ended", { startsAt: START, endsAt: END });
  assert.equal(err.status, 409);
  assert.equal(err.code, "test_ended");
  assert.equal(err.endsAt, END);
  assert.ok(isTestWindowError(err));
  // A plain object with the same shape (e.g. after crossing a cache boundary).
  assert.ok(isTestWindowError({ code: "test_not_started", status: 403, message: "x", startsAt: START, endsAt: END }));
  assert.equal(isTestWindowError(new Error("nope")), false);
  // A pg error has a string `code` too — it must not be mistaken for a window error.
  assert.equal(isTestWindowError(Object.assign(new Error("dup"), { code: "23505" })), false);
  assert.equal(isTestWindowError(null), false);
});

test("timer cap: a 60-min test started 30 min before the window ends gets 30 min", () => {
  // Server says it is 07:00 UTC; the client clock runs 5 s fast.
  const serverNow = "2026-10-25T07:00:00.000Z";
  const clientNow = new Date(serverNow).getTime() + 5000;
  const deadline = windowDeadlineOnClientClock({ windowEndsAt: END, serverNow, clientNow });
  assert.equal(deadline, new Date(END).getTime() + 5000, "window end moved onto the client clock");
  assert.equal(cappedSittingSeconds({ durationSeconds: 3600, deadlineMs: deadline, nowMs: clientNow }), 1800);
  // Pressing Start 2 minutes later leaves 28 minutes.
  assert.equal(cappedSittingSeconds({ durationSeconds: 3600, deadlineMs: deadline, nowMs: clientNow + 120_000 }), 1680);
});

test("timer cap: the duration wins when the window ends later; no end = duration", () => {
  const serverNow = "2026-10-25T05:00:00.000Z";
  const clientNow = new Date(serverNow).getTime();
  const deadline = windowDeadlineOnClientClock({ windowEndsAt: END, serverNow, clientNow });
  assert.equal(cappedSittingSeconds({ durationSeconds: 3600, deadlineMs: deadline, nowMs: clientNow }), 3600);
  assert.equal(windowDeadlineOnClientClock({ windowEndsAt: null, serverNow, clientNow }), null);
  assert.equal(cappedSittingSeconds({ durationSeconds: 3600, deadlineMs: null, nowMs: clientNow }), 3600);
});

test("timer cap: never negative; a missing server clock falls back to the client clock", () => {
  const clientNow = plusSeconds(END, 30).getTime();
  const deadline = windowDeadlineOnClientClock({ windowEndsAt: END, serverNow: undefined, clientNow });
  assert.equal(deadline, new Date(END).getTime());
  assert.equal(cappedSittingSeconds({ durationSeconds: 3600, deadlineMs: deadline, nowMs: clientNow }), 0);
});

test("timer cap: the server's own sitting end caps it when earlier than the window end (R4-1)", () => {
  assert.equal(earliestDeadline(null, null), null);
  assert.equal(earliestDeadline(1000, null), 1000);
  assert.equal(earliestDeadline(null, 2000), 2000);
  assert.equal(earliestDeadline(3000, 2000), 2000);
  // Window ends 13:00; the server expects this sitting to end at 12:40.
  const serverNow = "2026-10-25T06:30:00.000Z"; // 12:00 IST
  const clientNow = new Date(serverNow).getTime() + 5_000; // client clock 5 s ahead
  const deadline = earliestDeadline(
    windowDeadlineOnClientClock({ windowEndsAt: END, serverNow, clientNow }),
    windowDeadlineOnClientClock({ windowEndsAt: "2026-10-25T07:10:00.000Z", serverNow, clientNow }),
  );
  assert.equal(cappedSittingSeconds({ durationSeconds: 3 * 3600, deadlineMs: deadline, nowMs: clientNow }), 40 * 60);
});

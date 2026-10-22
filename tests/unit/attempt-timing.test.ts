/**
 * G7 — the server decides how long a self test / DPP took.
 * Spec: V1/docs/bug-fixes/03-grading-points.md (G7).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ATTEMPT_CAP_SECONDS,
  minutesToSeconds,
  serverTimeTakenSeconds,
} from "@/server/attempt-timing";

const NOW = Date.parse("2026-10-22T10:00:00.000Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000);

test("a recorded start is capped at the duration", () => {
  assert.deepEqual(
    serverTimeTakenSeconds({ startedAt: ago(300), durationSeconds: 180, clientSeconds: 10, now: NOW }),
    { seconds: 180, source: "server" },
  );
});

test("a recorded start ignores the client's value entirely", () => {
  assert.deepEqual(
    serverTimeTakenSeconds({ startedAt: ago(30), durationSeconds: 3600, clientSeconds: 0, now: NOW }),
    { seconds: 30, source: "server" },
  );
  assert.equal(
    serverTimeTakenSeconds({ startedAt: ago(30), durationSeconds: 3600, clientSeconds: 99999, now: NOW }).seconds,
    30,
  );
});

test("a start in the future (clock skew) never yields a negative time", () => {
  assert.equal(serverTimeTakenSeconds({ startedAt: ago(-60), durationSeconds: 600, clientSeconds: 5, now: NOW }).seconds, 0);
});

test("a start passed as an ISO string works", () => {
  assert.equal(
    serverTimeTakenSeconds({ startedAt: ago(90).toISOString(), durationSeconds: 600, clientSeconds: null, now: NOW }).seconds,
    90,
  );
});

test("no start: a negative client value clamps to 0", () => {
  assert.deepEqual(
    serverTimeTakenSeconds({ startedAt: null, durationSeconds: 600, clientSeconds: -50, now: NOW }),
    { seconds: 0, source: "client" },
  );
});

test("no start: a huge client value clamps to the duration", () => {
  assert.deepEqual(
    serverTimeTakenSeconds({ startedAt: null, durationSeconds: 3600, clientSeconds: 99999, now: NOW }),
    { seconds: 3600, source: "client" },
  );
});

test("no start: garbage client values become 0", () => {
  for (const clientSeconds of [undefined, null, "abc", Number.NaN, Number.POSITIVE_INFINITY, {}]) {
    assert.equal(serverTimeTakenSeconds({ startedAt: null, durationSeconds: 600, clientSeconds }).seconds, 0);
  }
  assert.equal(serverTimeTakenSeconds({ startedAt: null, durationSeconds: 600, clientSeconds: "120" }).seconds, 120);
});

test("no duration: the cap is 6 hours", () => {
  assert.equal(DEFAULT_ATTEMPT_CAP_SECONDS, 6 * 3600);
  for (const durationSeconds of [null, undefined, 0, -5, Number.NaN]) {
    assert.equal(
      serverTimeTakenSeconds({ startedAt: ago(10 * 3600), durationSeconds, clientSeconds: 0, now: NOW }).seconds,
      6 * 3600,
    );
    assert.equal(
      serverTimeTakenSeconds({ startedAt: null, durationSeconds, clientSeconds: 99999 }).seconds,
      6 * 3600,
    );
  }
});

test("an unparseable start falls back to the clamped client value", () => {
  assert.deepEqual(
    serverTimeTakenSeconds({ startedAt: "not-a-date", durationSeconds: 600, clientSeconds: 42, now: NOW }),
    { seconds: 42, source: "client" },
  );
});

test("minutesToSeconds converts durations and rejects empty ones", () => {
  assert.equal(minutesToSeconds(30), 1800);
  assert.equal(minutesToSeconds(0), null);
  assert.equal(minutesToSeconds(null), null);
  assert.equal(minutesToSeconds(undefined), null);
  assert.equal(minutesToSeconds(-1), null);
});

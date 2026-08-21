/**
 * Contest reminder scheduling unit tests (Phase 2b). Verifies the "which
 * start-relative reminders are due now" logic across the window boundaries.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dueStartReminders, reminderCopy } from "@/lib/contest/reminders";

const START = new Date("2026-09-01T13:00:00Z");
const minus = (ms: number) => new Date(START.getTime() - ms);
const H = 3_600_000;
const M = 60_000;

test("no reminders long before the contest (>24h out)", () => {
  assert.deepEqual(dueStartReminders(START, minus(48 * H)), []);
});

test("t_24h becomes due inside 24h", () => {
  assert.deepEqual(dueStartReminders(START, minus(23 * H)), ["t_24h"]);
});

test("t_1h adds inside 1h (24h still due — ledger dedupes)", () => {
  assert.deepEqual(dueStartReminders(START, minus(30 * M)), ["t_24h", "t_1h"]);
});

test("t_10m adds inside 10m", () => {
  assert.deepEqual(dueStartReminders(START, minus(5 * M)), ["t_24h", "t_1h", "t_10m"]);
});

test("nothing 'starts soon' once started", () => {
  assert.deepEqual(dueStartReminders(START, new Date(START.getTime())), []);
  assert.deepEqual(dueStartReminders(START, new Date(START.getTime() + M)), []);
});

test("null start → no reminders", () => {
  assert.deepEqual(dueStartReminders(null, START), []);
});

test("copy is populated for every kind", () => {
  for (const kind of ["confirmation", "t_24h", "t_1h", "t_10m", "results"] as const) {
    const c = reminderCopy(kind, "Origin Weekly #1");
    assert.ok(c.title.length > 0);
    assert.ok(c.body.includes("Origin Weekly #1"));
  }
});

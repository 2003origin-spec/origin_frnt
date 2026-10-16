import test from "node:test";
import assert from "node:assert/strict";

import {
  EXTENSION_REQUEST_TTL_MS,
  decidePayable,
  firstNameOnly,
  isExtensionRequestOpen,
  isShortSession,
  noShowSide,
  sessionEndsAt,
} from "@/server/now/session-rules";
import { NO_SHOW_WINDOW_MS } from "@/server/now/types";

const base = {
  solverKind: "human" as const,
  studentJoined: true,
  helperJoined: true,
  outcome: "resolved" as const,
  ownOrLinkedAccount: false,
  openReport: false,
};

test("a human session pays only with both joined, an outcome, no report, not own account", () => {
  assert.equal(decidePayable(base), true);
  assert.equal(decidePayable({ ...base, outcome: "unresolved" }), true, "an honest 'unresolved' still pays");
  assert.equal(decidePayable({ ...base, outcome: null }), false);
  assert.equal(decidePayable({ ...base, studentJoined: false }), false);
  assert.equal(decidePayable({ ...base, helperJoined: false }), false);
  assert.equal(decidePayable({ ...base, ownOrLinkedAccount: true }), false);
  assert.equal(decidePayable({ ...base, openReport: true }), false);
});

test("a bot session pays without an outcome but never on an open report", () => {
  assert.equal(decidePayable({ ...base, solverKind: "bot", outcome: null }), true);
  assert.equal(decidePayable({ ...base, solverKind: "bot", outcome: null, openReport: true }), false);
});

test("no-show: nobody is blamed before the window; a missing solver is blamed first", () => {
  const acceptedAt = new Date("2026-10-17T13:00:00Z");
  const early = new Date(acceptedAt.getTime() + NO_SHOW_WINDOW_MS - 1);
  const late = new Date(acceptedAt.getTime() + NO_SHOW_WINDOW_MS);
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: null, now: early }), "not_yet");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: null, now: late }), "helper");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: acceptedAt, helperJoinedAt: null, now: late }), "helper");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: acceptedAt, now: late }), "student");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: acceptedAt, helperJoinedAt: acceptedAt, now: late }), "none");
});

test("timing helpers", () => {
  const start = new Date("2026-10-17T13:00:00Z");
  assert.equal(sessionEndsAt(start, 5).toISOString(), "2026-10-17T13:05:00.000Z");
  assert.equal(isShortSession(start, new Date(start.getTime() + 60_000)), true);
  assert.equal(isShortSession(start, new Date(start.getTime() + 3 * 60_000)), false);
  assert.equal(isShortSession(null, start), false);
  assert.equal(isExtensionRequestOpen(null, start), false);
  assert.equal(isExtensionRequestOpen(start, new Date(start.getTime() + EXTENSION_REQUEST_TTL_MS)), true);
  assert.equal(isExtensionRequestOpen(start, new Date(start.getTime() + EXTENSION_REQUEST_TTL_MS + 1)), false);
});

test("a solver only ever sees the student's first name", () => {
  assert.equal(firstNameOnly("  Meera   Iyer "), "Meera");
  assert.equal(firstNameOnly(""), "Student");
  assert.equal(firstNameOnly(null), "Student");
});

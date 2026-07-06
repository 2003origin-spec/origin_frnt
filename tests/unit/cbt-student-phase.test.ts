/**
 * Phase 0 (CBT) — exam-integrity: no re-attempt after submit. These pure guards
 * are the client half of the rule (the server refuses every write/read for a
 * finished attempt). `phaseFromState` must resolve a finished attempt to
 * `submitted`, and `nextPhase` must make terminal phases sticky so no refresh /
 * realtime event / bfcache restore can pull a student back into the test.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isTerminalPhase, nextPhase, phaseFromState } from "@/lib/cbt/student-phase";

test("phaseFromState resolves a finished attempt to submitted, even while the room is in_test", () => {
  assert.equal(
    phaseFromState({ room: { status: "in_test" }, participant: { finishedAt: "2026-07-06T10:00:00Z" } }),
    "submitted",
  );
  // Not finished, test running → in_test.
  assert.equal(phaseFromState({ room: { status: "in_test" }, participant: { finishedAt: null } }), "in_test");
  // Closed room wins over everything.
  assert.equal(
    phaseFromState({ room: { status: "closed" }, participant: { finishedAt: null } }),
    "closed",
  );
  // Waiting room.
  assert.equal(phaseFromState({ room: { status: "waiting" }, participant: { finishedAt: null } }), "lobby");
});

test("terminal phases are sticky — nextPhase never re-opens the test after submit", () => {
  assert.ok(isTerminalPhase("submitted"));
  assert.ok(isTerminalPhase("closed"));
  assert.ok(isTerminalPhase("kicked"));
  assert.ok(!isTerminalPhase("in_test"));
  assert.ok(!isTerminalPhase("lobby"));

  // A submitted student cannot be pulled back into the test by any incoming
  // phase (stale state refresh, a late test_started SSE event, bfcache re-check).
  assert.equal(nextPhase("submitted", "in_test"), "submitted");
  assert.equal(nextPhase("submitted", "lobby"), "submitted");
  assert.equal(nextPhase("kicked", "in_test"), "kicked");
  assert.equal(nextPhase("closed", "in_test"), "closed");

  // Non-terminal transitions still flow normally.
  assert.equal(nextPhase("lobby", "in_test"), "in_test");
  assert.equal(nextPhase("in_test", "submitted"), "submitted");
  assert.equal(nextPhase("checking", "join"), "join");
});

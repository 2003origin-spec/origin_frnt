/**
 * Origin NOW request state machine. Every edge in the plan doc's diagram is
 * covered, plus the illegal moves a racing handler could attempt.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { canTransition, holdDisposition, isOpen, isTerminal, transition, type RequestEvent } from "@/server/now/session-state";
import { REQUEST_STATUSES, type RequestStatus } from "@/server/now/types";

const happyPath: [RequestStatus, RequestEvent, RequestStatus][] = [
  ["requested", "offer_sent", "offered"],
  ["offered", "offer_accepted", "accepted"],
  ["accepted", "both_joined", "live"],
  ["live", "session_ended", "ended"],
  ["ended", "rated", "rated"],
];

test("the happy path runs requested → rated", () => {
  for (const [from, event, to] of happyPath) {
    assert.deepEqual(transition(from, event), { ok: true, from, to }, `${from} --${event}-->`);
  }
});

test("a declined or expired offer goes back to requested for the next helper", () => {
  for (const event of ["offer_declined", "offer_expired"] as const) {
    const result = transition("offered", event);
    assert.ok(result.ok && result.to === "requested", event);
  }
});

test("a helper no-show loops back to requested; a student no-show closes", () => {
  const helper = transition("accepted", "helper_no_show");
  const student = transition("accepted", "student_no_show");
  assert.ok(helper.ok && helper.to === "requested");
  assert.ok(student.ok && student.to === "no_show");
});

test("the bot can take a waiting request but not one a human already accepted", () => {
  assert.ok(canTransition("requested", "bot_assigned"));
  assert.ok(canTransition("offered", "bot_assigned"));
  assert.equal(canTransition("accepted", "bot_assigned"), false);
  assert.equal(canTransition("live", "bot_assigned"), false);
});

test("give-up and cancel only apply before a session is live", () => {
  assert.ok(canTransition("requested", "give_up"));
  assert.ok(canTransition("offered", "give_up"));
  assert.equal(canTransition("accepted", "give_up"), false);
  assert.ok(canTransition("accepted", "student_cancelled"));
  assert.equal(canTransition("live", "student_cancelled"), false);
});

test("an unrated session closes after the rating window", () => {
  const result = transition("ended", "rating_window_closed");
  assert.ok(result.ok && result.to === "unrated");
});

test("no event leaves a terminal status", () => {
  const events: RequestEvent[] = [
    "offer_sent",
    "offer_declined",
    "offer_expired",
    "offer_accepted",
    "bot_assigned",
    "both_joined",
    "helper_no_show",
    "student_no_show",
    "student_cancelled",
    "give_up",
    "session_ended",
    "rated",
    "rating_window_closed",
  ];
  for (const status of REQUEST_STATUSES.filter(isTerminal)) {
    for (const event of events) {
      assert.equal(canTransition(status, event), false, `${status} --${event}--> must be refused`);
    }
  }
});

test("a refused transition says why", () => {
  const result = transition("rated", "offer_sent");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /offer_sent/);
});

test("the coin hold is released on every exit and decided at end otherwise", () => {
  assert.equal(holdDisposition("cancelled"), "release");
  assert.equal(holdDisposition("no_helper"), "release");
  assert.equal(holdDisposition("no_show"), "release");
  assert.equal(holdDisposition("ended"), "decide_at_end");
  assert.equal(holdDisposition("live"), "keep");
  assert.equal(holdDisposition("requested"), "keep");
});

test("open requests are the ones that count against one-live-request-per-student", () => {
  assert.ok(isOpen("requested"));
  assert.ok(isOpen("live"));
  assert.equal(isOpen("ended"), false);
  assert.equal(isOpen("cancelled"), false);
});

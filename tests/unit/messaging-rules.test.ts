/**
 * Student messaging — the pure rules: units, the daily cap by IST day, and the
 * message-request state machine (src/server/messaging/rules.ts).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUsage,
  countWords,
  dailyLimitError,
  dailyUnitLimit,
  fitsDailyCap,
  messageUnits,
  MessagingError,
  nextStatus,
  normalizeMessageText,
  orderedPair,
  sendDecision,
  usageWindow,
  type ConversationState,
} from "../../src/server/messaging/rules";

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

function refusal(fn: () => unknown): { status: number; code: string; detail: string } {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof MessagingError, `expected a MessagingError, got ${error}`);
    return { status: error.status, code: error.code, detail: error.message };
  }
  assert.fail("expected a refusal");
}

// ── Units ───────────────────────────────────────────────────────────────────

test("units = max(1, ceil(words / 10))", () => {
  assert.equal(messageUnits("hi"), 1);
  assert.equal(messageUnits(words(10)), 1);
  assert.equal(messageUnits(words(11)), 2);
  assert.equal(messageUnits(words(20)), 2);
  assert.equal(messageUnits(words(21)), 3);
  assert.equal(messageUnits("   "), 1, "never zero");
  assert.equal(messageUnits("👍"), 1);
});

test("words are whitespace-separated tokens (newlines and tabs too)", () => {
  assert.equal(countWords("  a  b\n\nc\td  "), 4);
  assert.equal(countWords("don't-stop e=mc^2"), 2);
  assert.equal(countWords(""), 0);
});

test("text: trimmed, NUL dropped, empty and >500 refused (emoji = one character)", () => {
  assert.equal(normalizeMessageText("  hello \u0000 "), "hello");
  assert.deepEqual(refusal(() => normalizeMessageText("   ")), { status: 400, code: "empty", detail: "Write a message first." });
  assert.equal(refusal(() => normalizeMessageText(42)).code, "empty");
  assert.equal(normalizeMessageText("a".repeat(500)).length, 500);
  assert.deepEqual(refusal(() => normalizeMessageText("a".repeat(501))), {
    status: 400,
    code: "too_long",
    detail: "Keep a message under 500 characters.",
  });
  assert.equal([...normalizeMessageText("😀".repeat(500))].length, 500, "500 emoji fit (code points, not UTF-16 units)");
});

// ── Daily cap ───────────────────────────────────────────────────────────────

test("daily limit: free 10, premium 40, env overrides, junk env ignored", () => {
  assert.equal(dailyUnitLimit(false, {}), 10);
  assert.equal(dailyUnitLimit(true, {}), 40);
  assert.equal(dailyUnitLimit(false, { MESSAGING_DAILY_UNITS_FREE: "15" }), 15);
  assert.equal(dailyUnitLimit(true, { MESSAGING_DAILY_UNITS_PREMIUM: "100" }), 100);
  for (const junk of ["0", "-5", "abc", "2.5", " "]) {
    assert.equal(dailyUnitLimit(false, { MESSAGING_DAILY_UNITS_FREE: junk }), 10, junk);
  }
});

test("cap math: a message must fit whole in what is left", () => {
  assert.equal(fitsDailyCap(0, 10, 10), true);
  assert.equal(fitsDailyCap(9, 1, 10), true);
  assert.equal(fitsDailyCap(10, 1, 10), false);
  assert.equal(fitsDailyCap(8, 3, 10), false);
});

test("the IST day rolls over at 00:00 IST, not UTC", () => {
  const beforeMidnight = Date.parse("2026-11-01T23:59:59.999+05:30");
  const atMidnight = Date.parse("2026-11-02T00:00:00.000+05:30");
  assert.deepEqual(usageWindow(beforeMidnight), { day: "2026-11-01", resetsAt: "2026-11-01T18:30:00.000Z" });
  assert.deepEqual(usageWindow(atMidnight), { day: "2026-11-02", resetsAt: "2026-11-02T18:30:00.000Z" });
  // 20:00 UTC is already 01:30 IST the next day; 18:29:59 UTC is 23:59:59 IST.
  assert.equal(usageWindow(Date.parse("2026-11-01T20:00:00Z")).day, "2026-11-02");
  assert.equal(usageWindow(Date.parse("2026-11-01T18:29:59Z")).day, "2026-11-01");
});

test("usage carries limit, premium and the next IST midnight", () => {
  const now = Date.parse("2026-11-01T10:00:00+05:30");
  assert.deepEqual(buildUsage(3, false, now, {}), { used: 3, limit: 10, premium: false, resetsAt: "2026-11-01T18:30:00.000Z" });
  assert.equal(buildUsage(3, true, now, {}).limit, 40);
});

test("daily_limit is a 429 with usage in the body; wording says what is left", () => {
  const now = Date.parse("2026-11-01T10:00:00+05:30");
  const spent = dailyLimitError(buildUsage(10, false, now, {}), 1);
  assert.equal(spent.status, 429);
  assert.equal(spent.code, "daily_limit");
  assert.equal(spent.message, "You've used today's 10 messages. More at midnight.");
  assert.deepEqual((spent.extra.usage as { premium: boolean }).premium, false);
  const partial = dailyLimitError(buildUsage(8, false, now, {}), 3);
  assert.equal(partial.code, "daily_limit");
  assert.match(partial.message, /needs 3 of your 2 messages left today/);
});

// ── Request state machine ───────────────────────────────────────────────────

const pending: ConversationState = { status: "pending", requestedBy: "alice" };
const accepted: ConversationState = { status: "accepted", requestedBy: "alice" };
const declined: ConversationState = { status: "declined", requestedBy: "alice" };
const blocked: ConversationState = { status: "blocked", requestedBy: "alice" };

test("a pending sender can't send twice", () => {
  assert.deepEqual(refusal(() => sendDecision(pending, "alice", "Bob")), {
    status: 409,
    code: "request_pending",
    detail: "Wait for Bob to accept your request.",
  });
});

test("the recipient replying to a request accepts it", () => {
  assert.deepEqual(sendDecision(pending, "bob", "Alice"), { implicitAccept: true });
});

test("accept unlocks both sides", () => {
  assert.equal(nextStatus(pending, "bob", "accept", "Alice"), "accepted");
  assert.deepEqual(sendDecision(accepted, "alice", "Bob"), { implicitAccept: false });
  assert.deepEqual(sendDecision(accepted, "bob", "Alice"), { implicitAccept: false });
});

test("only the recipient can accept or decline", () => {
  assert.equal(refusal(() => nextStatus(pending, "alice", "accept", "Bob")).code, "request_pending");
  assert.equal(refusal(() => nextStatus(pending, "alice", "decline", "Bob")).code, "request_pending");
  assert.equal(nextStatus(accepted, "alice", "accept", "Bob"), "accepted", "repeat is a no-op");
});

test("decline: the sender is told, can't send again; the recipient may still accept later", () => {
  assert.equal(nextStatus(pending, "bob", "decline", "Alice"), "declined");
  assert.equal(nextStatus(declined, "bob", "decline", "Alice"), "declined", "repeat is a no-op");
  assert.deepEqual(refusal(() => sendDecision(declined, "alice", "Bob")), {
    status: 409,
    code: "declined",
    detail: "Bob didn't accept your request.",
  });
  assert.equal(refusal(() => sendDecision(declined, "bob", "Alice")).code, "declined");
  assert.equal(nextStatus(declined, "bob", "accept", "Alice"), "accepted");
  assert.equal(refusal(() => nextStatus(declined, "alice", "accept", "Bob")).code, "declined");
  assert.equal(nextStatus(accepted, "bob", "decline", "Alice"), "accepted", "declining an open chat changes nothing");
});

test("block: either side, from any state; afterwards nobody can send or reopen it", () => {
  for (const state of [pending, accepted, declined, blocked]) {
    assert.equal(nextStatus(state, "alice", "block", "Bob"), "blocked");
    assert.equal(nextStatus(state, "bob", "block", "Alice"), "blocked");
  }
  for (const me of ["alice", "bob"]) {
    assert.deepEqual(refusal(() => sendDecision(blocked, me, "X")), {
      status: 403,
      code: "blocked",
      detail: "You can't message this student.",
    });
    assert.equal(refusal(() => nextStatus(blocked, me, "accept", "X")).code, "blocked");
  }
});

test("a pair has one fixed order", () => {
  assert.deepEqual(orderedPair("u_b", "u_a"), ["u_a", "u_b"]);
  assert.deepEqual(orderedPair("u_a", "u_b"), ["u_a", "u_b"]);
});

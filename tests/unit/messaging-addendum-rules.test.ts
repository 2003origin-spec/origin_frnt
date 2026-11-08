/**
 * Student messaging addendum (02/11/2026) — the pure parts: what an unblock
 * restores, the suspension text (dd/mm/yyyy, IST day), the suspend-days input,
 * and the push payloads.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildMessagingPush, pushPreview } from "../../src/server/messaging/push";
import {
  parseSuspendDays,
  statusAfterUnblock,
  statusToRemember,
  storedReportStatus,
  suspendedError,
  suspensionDetail,
  suspensionEndsAt,
} from "../../src/server/messaging/rules";

test("a block remembers the status it replaced; a second block keeps the first memory", () => {
  assert.equal(statusToRemember("accepted", null), "accepted");
  assert.equal(statusToRemember("pending", null), "pending");
  assert.equal(statusToRemember("declined", null), "declined");
  assert.equal(statusToRemember("blocked", "accepted"), "accepted", "the other student blocking too doesn't overwrite it");
  assert.equal(statusToRemember("blocked", null), null);
});

test("unblock restores accepted / pending, falls back to declined, and stays blocked while the other still blocks", () => {
  assert.equal(statusAfterUnblock("blocked", "accepted", false), "accepted");
  assert.equal(statusAfterUnblock("blocked", "pending", false), "pending");
  assert.equal(statusAfterUnblock("blocked", "declined", false), "declined");
  assert.equal(statusAfterUnblock("blocked", null, false), "declined", "nothing saved (blocked before the addendum)");
  assert.equal(statusAfterUnblock("blocked", "accepted", true), "blocked");
  assert.equal(statusAfterUnblock("accepted", null, false), "accepted", "not blocked: unchanged");
});

test("suspension text is the IST calendar day, dd/mm/yyyy", () => {
  // 04/11/2026 20:00 UTC is already 05/11/2026 01:30 in IST.
  assert.equal(suspensionDetail(new Date("2026-11-04T20:00:00Z")), "Messaging is paused on your account until 05/11/2026.");
  assert.equal(suspensionDetail("2026-11-04T10:00:00Z"), "Messaging is paused on your account until 04/11/2026.");
  const error = suspendedError(new Date("2026-12-31T12:00:00Z"));
  assert.equal(error.status, 403);
  assert.equal(error.code, "suspended");
  assert.equal(error.message, "Messaging is paused on your account until 31/12/2026.");
});

test("suspend days: whole days 1..90 only; the end is N days from now", () => {
  assert.equal(parseSuspendDays(1), 1);
  assert.equal(parseSuspendDays(90), 90);
  assert.equal(parseSuspendDays("7"), 7);
  for (const bad of [0, 91, 2.5, -1, "", "abc", null, undefined, true]) assert.equal(parseSuspendDays(bad), null, String(bad));
  const now = Date.parse("2026-11-02T06:00:00Z");
  assert.equal(suspensionEndsAt(now, 7).toISOString(), "2026-11-09T06:00:00.000Z");
});

test("report resolutions are stored as reviewed / dismissed", () => {
  assert.equal(storedReportStatus("dismiss"), "dismissed");
  assert.equal(storedReportStatus("warn"), "reviewed");
  assert.equal(storedReportStatus("suspend"), "reviewed");
});

test("push payloads match the contract (title, body, data, link)", () => {
  assert.deepEqual(buildMessagingPush("message_request", { name: "Alice", conversationId: "c1", text: "hi there" }), {
    title: "Message request",
    body: "Alice: hi there",
    route: "/messages?box=requests",
    data: { type: "message_request", conversationId: "c1", link: "/messages?box=requests" },
  });
  assert.deepEqual(buildMessagingPush("message_accepted", { name: "Bob", conversationId: "c1" }), {
    title: "Bob accepted your request",
    body: "",
    route: "/messages/c1",
    data: { type: "message_accepted", conversationId: "c1", link: "/messages/c1" },
  });
  const long = "x".repeat(79) + "🙂" + "y".repeat(50);
  const message = buildMessagingPush("message", { name: "Alice", conversationId: "c2", text: long });
  assert.equal(message.title, "Alice");
  assert.equal(message.body, "x".repeat(79) + "🙂", "first 80 characters, an emoji counted as one");
  assert.deepEqual(message.data, { type: "message", conversationId: "c2", link: "/messages/c2" });
  assert.equal(pushPreview("  short  "), "short");
});

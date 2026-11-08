/**
 * Admin announcements — the pure rules: title/text/link validation (incl. link
 * safety), audience parsing, the double-send and hourly limits, and the
 * delivery loop (limited concurrency, failures counted but never fatal).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_STUDENTS,
  ANNOUNCEMENT_QUICK_LINKS,
  audienceKey,
  charCount,
  describeAudience,
  isSafeInternalLink,
  parseAudience,
  validateAnnouncementDraft,
  type AnnouncementAudience,
} from "../../src/lib/announcements";
import {
  AnnouncementError,
  DUPLICATE_WINDOW_MS,
  HOUR_MS,
  SENDS_PER_HOUR,
  checkSendGuards,
  deliverAnnouncement,
  forEachLimited,
  type RecentSend,
} from "../../src/server/announcements/rules";

// ── Validation ──────────────────────────────────────────────────────────────

test("draft: trims, defaults the link to /, and keeps the title on one line", () => {
  const checked = validateAnnouncementDraft({ title: "  Mock test\nSunday ", body: "  Opens at 10 am.\nGood luck  ", link: "" });
  assert.deepEqual(checked, { ok: true, draft: { title: "Mock test Sunday", body: "Opens at 10 am.\nGood luck", link: "/" } });
  const noLink = validateAnnouncementDraft({ title: "T", body: "B" });
  assert.equal(noLink.ok && noLink.draft.link, "/");
});

test("draft: title 1–65 and text 1–240 characters, counted like Postgres (an emoji is 1)", () => {
  assert.equal(validateAnnouncementDraft({ title: "x".repeat(65), body: "y".repeat(240) }).ok, true);
  const tooLong = validateAnnouncementDraft({ title: "x".repeat(66), body: "y".repeat(241) });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) {
    assert.match(tooLong.errors.title ?? "", /65 characters/u);
    assert.match(tooLong.errors.body ?? "", /240 characters/u);
  }
  const empty = validateAnnouncementDraft({ title: "   ", body: "\u0000" });
  assert.equal(empty.ok, false);
  if (!empty.ok) {
    assert.equal(empty.errors.title, "Write a title.");
    assert.equal(empty.errors.body, "Write the announcement text.");
  }
  // 65 emoji = 130 UTF-16 units but 65 characters.
  assert.equal(charCount("🎉".repeat(65)), 65);
  assert.equal(validateAnnouncementDraft({ title: "🎉".repeat(65), body: "ok" }).ok, true);
  assert.equal(validateAnnouncementDraft({ title: 42, body: ["x"] }).ok, false);
});

test("link safety: only paths on this site", () => {
  for (const ok of ["/", "/dashboard", "/tests?tab=mine", "/notes?tab=shared&x=1#top", "/u/some_one-2", "/ogcode/deck%20one"]) {
    assert.equal(isSafeInternalLink(ok), true, ok);
  }
  for (const bad of [
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "http://evil.com",
    "https://www.o3origin.com/dashboard",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,hi",
    "dashboard",
    " /dashboard",
    "/dash board",
    "/a\nb",
    "/<script>",
    `/${"a".repeat(200)}`,
    "",
  ]) {
    assert.equal(isSafeInternalLink(bad), false, JSON.stringify(bad));
  }
  const checked = validateAnnouncementDraft({ title: "T", body: "B", link: "javascript:alert(1)" });
  assert.equal(checked.ok, false);
  if (!checked.ok) assert.match(checked.errors.link ?? "", /starting with "\/"/u);
});

test("every quick-pick link is a safe path", () => {
  for (const q of ANNOUNCEMENT_QUICK_LINKS) assert.equal(isSafeInternalLink(q.path), true, q.path);
});

// ── Audience ────────────────────────────────────────────────────────────────

test("audience parsing: students with optional class / exam / premium, or me", () => {
  assert.deepEqual(parseAudience({ kind: "students" }), ALL_STUDENTS);
  assert.deepEqual(parseAudience({ kind: "students", studentClass: "12", exam: "neet", premiumOnly: true }), {
    kind: "students",
    studentClass: "12",
    exam: "neet",
    premiumOnly: true,
  });
  assert.deepEqual(parseAudience({ kind: "students", studentClass: "dropper", exam: null }), {
    kind: "students",
    studentClass: "dropper",
    exam: null,
    premiumOnly: false,
  });
  assert.deepEqual(parseAudience({ kind: "me", studentClass: "11" }), { kind: "me" });
  for (const bad of [
    null,
    undefined,
    "all",
    [],
    { kind: "everyone" },
    { kind: "students", studentClass: 12 },
    { kind: "students", studentClass: "13" },
    { kind: "students", exam: "JEE" },
    { kind: "students", exam: "upsc" },
    { kind: "students", premiumOnly: "yes" },
    { kind: "teachers" },
  ]) {
    assert.equal(parseAudience(bad), null, JSON.stringify(bad));
  }
});

test("audience labels and keys", () => {
  assert.equal(describeAudience(ALL_STUDENTS), "All students");
  assert.equal(describeAudience({ kind: "me" }), "Test: only me");
  assert.equal(describeAudience({ kind: "students", studentClass: "12", exam: "neet", premiumOnly: true }), "Students: Class 12 · NEET · Premium");
  assert.equal(describeAudience({ kind: "students", studentClass: "dropper", exam: null, premiumOnly: false }), "Students: Droppers");
  assert.equal(audienceKey(ALL_STUDENTS), audienceKey(parseAudience({ kind: "students" })!));
  assert.notEqual(audienceKey(ALL_STUDENTS), audienceKey({ kind: "students", studentClass: null, exam: null, premiumOnly: true }));
  assert.equal(audienceKey({ kind: "me" }), "me");
});

// ── Double send and hourly limit ────────────────────────────────────────────

const NOW = Date.parse("2026-11-02T10:00:00Z");
const draft = { title: "Mock test", body: "Sunday 10 am", link: "/tests" };
const send = (msAgo: number, over: Partial<RecentSend> = {}): RecentSend => ({
  title: draft.title,
  body: draft.body,
  audience: ALL_STUDENTS,
  test: false,
  createdAt: new Date(NOW - msAgo),
  ...over,
});
function refusal(fn: () => void): AnnouncementError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof AnnouncementError);
    return error;
  }
  assert.fail("expected a refusal");
}

test("double send: same title + text + audience within 2 minutes is a 409", () => {
  const error = refusal(() => checkSendGuards([send(30_000)], { draft, audience: ALL_STUDENTS, test: false }, NOW));
  assert.equal(error.status, 409);
  assert.equal(error.code, "duplicate");
  assert.match(error.message, /less than a minute ago/u);
  assert.match(error.message, /wait 2 minutes/u);
  // Same for two test sends to yourself.
  const me: AnnouncementAudience = { kind: "me" };
  assert.equal(refusal(() => checkSendGuards([send(90_000, { audience: me, test: true })], { draft, audience: me, test: true }, NOW)).status, 409);
});

test("not a double send: after 2 minutes, other text, other title or another audience", () => {
  const ok = (recent: RecentSend[], audience: AnnouncementAudience = ALL_STUDENTS) =>
    assert.doesNotThrow(() => checkSendGuards(recent, { draft, audience, test: audience.kind === "me" }, NOW));
  ok([send(DUPLICATE_WINDOW_MS)]);
  ok([send(10_000, { body: "Sunday 11 am" })]);
  ok([send(10_000, { title: "Mock test!" })]);
  ok([send(10_000)], { kind: "students", studentClass: "12", exam: null, premiumOnly: false });
  ok([send(10_000)], { kind: "me" });
  ok([]);
});

test("hourly limit: the 11th real send in an hour is a 429; tests don't count and aren't limited", () => {
  const ten = Array.from({ length: SENDS_PER_HOUR }, (_, i) => send(5 * 60_000 + i * 60_000, { title: `Old ${i}` }));
  const error = refusal(() => checkSendGuards(ten, { draft, audience: ALL_STUDENTS, test: false }, NOW));
  assert.equal(error.status, 429);
  assert.equal(error.code, "hourly_limit");
  // The oldest of the ten was 14 minutes ago, so a slot frees in 46 minutes.
  assert.match(error.message, /10 announcements an hour\. Try again in 46 minutes\./u);

  // Nine real sends + many tests: allowed.
  const mixed = [...ten.slice(0, 9), ...Array.from({ length: 20 }, (_, i) => send(60_000 * i + 200_000, { title: `T${i}`, test: true }))];
  assert.doesNotThrow(() => checkSendGuards(mixed, { draft, audience: ALL_STUDENTS, test: false }, NOW));
  // A test send is never limited by the hourly cap.
  assert.doesNotThrow(() => checkSendGuards(ten, { draft, audience: { kind: "me" }, test: true }, NOW));
  // Sends older than an hour don't count.
  const old = Array.from({ length: 15 }, (_, i) => send(HOUR_MS + i * 1000, { title: `Old ${i}` }));
  assert.doesNotThrow(() => checkSendGuards(old, { draft, audience: ALL_STUDENTS, test: false }, NOW));
});

// ── Delivery ────────────────────────────────────────────────────────────────

test("forEachLimited: never more than the limit at once, and every item runs", async () => {
  let active = 0;
  let peak = 0;
  const seen: number[] = [];
  await forEachLimited(Array.from({ length: 37 }, (_, i) => i), 10, async (i) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    seen.push(i);
    active -= 1;
    if (i === 3) throw new Error("boom");
  });
  assert.equal(peak, 10);
  assert.equal(seen.length, 37);
  await forEachLimited([], 10, async () => assert.fail("no items"));
});

test("deliver: everyone gets the in-app notification; push only with a device; failures counted, never fatal", async () => {
  const notified: string[] = [];
  const pushed: string[] = [];
  const recipients = [
    { userId: "a", hasPush: true },
    { userId: "b", hasPush: false },
    { userId: "c", hasPush: true }, // push throws
    { userId: "d", hasPush: true }, // FCM took none of the devices
    { userId: "e", hasPush: true }, // notification throws
  ];
  const counts = await deliverAnnouncement(recipients, {
    pushConfigured: true,
    concurrency: 2,
    notify: async (id) => {
      if (id === "e") throw new Error("db down");
      notified.push(id);
    },
    push: async (id) => {
      pushed.push(id);
      if (id === "c") throw new Error("fcm down");
      return id === "d" ? { attempted: 2, delivered: 0 } : { attempted: 1, delivered: 1 };
    },
  });
  assert.deepEqual(counts, { notified: 4, pushAttempted: 4, pushDelivered: 2 });
  assert.deepEqual(notified.sort(), ["a", "b", "c", "d"]);
  assert.deepEqual(pushed.sort(), ["a", "c", "d", "e"]);
});

test("deliver: no push at all when push isn't configured", async () => {
  let pushes = 0;
  const counts = await deliverAnnouncement([{ userId: "a", hasPush: true }], {
    pushConfigured: false,
    notify: async () => undefined,
    push: async () => {
      pushes += 1;
      return { attempted: 1, delivered: 1 };
    },
  });
  assert.deepEqual(counts, { notified: 1, pushAttempted: 0, pushDelivered: 0 });
  assert.equal(pushes, 0);
});

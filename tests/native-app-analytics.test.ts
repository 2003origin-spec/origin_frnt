import test from "node:test";
import assert from "node:assert/strict";

import { aggregatePractice, aggregateTopics, summarizeActivity } from "../src/server/mobile/student-analytics";

// V1/NATIVE_APP_API_PLAN.md — the native app's progress screen.

const row = (topic: string, accuracy: number, attempts: number, created_at: string, extra: Record<string, unknown> = {}) => ({
  topic,
  subject: "physics",
  chapter: "Kinematics",
  accuracy,
  attempts,
  bkt_mastery: null,
  created_at,
  ...extra,
});

test("topics merge across tests, weighted by attempts (accuracy stored as %)", () => {
  const out = aggregateTopics([
    row("Projectile", 0, 2, "2026-10-24T10:00:00Z", { bkt_mastery: 0.2 }), // newest
    row("Projectile", 100, 2, "2026-10-20T10:00:00Z", { bkt_mastery: 0.9 }),
    row("Relative motion", 100, 3, "2026-10-24T10:00:00Z"),
    row("Units", 0, 1, "2026-10-24T10:00:00Z"),
  ]);
  assert.deepEqual(out.weak.map((t) => [t.topic, t.accuracy, t.attempts]), [["Units", 0, 1]]);
  assert.deepEqual(out.strong.map((t) => [t.topic, t.accuracy]), [["Relative motion", 1]]);
  // 50% sits between the bands; the newest mastery wins.
  const all = aggregateTopics([row("Projectile", 0, 2, "2026-10-24T10:00:00Z", { bkt_mastery: 0.2 }), row("Projectile", 100, 2, "2026-10-20T10:00:00Z", { bkt_mastery: 0.9 })]);
  assert.equal(all.weak.length + all.strong.length, 0);
});

test("topics with no attempts or no name are ignored; topic names match without case", () => {
  const out = aggregateTopics([row("", 0, 3, "2026-10-24T10:00:00Z"), row("Units", 0, 0, "2026-10-24T10:00:00Z"), row("units ", 0, 1, "2026-10-24T10:00:00Z"), row("Units", 0, 1, "2026-10-23T10:00:00Z")]);
  assert.equal(out.weak.length, 1);
  assert.equal(out.weak[0].attempts, 2);
});

test("practice groups by subject and chapter: distinct questions tried and solved, accuracy per try", () => {
  const questions = new Map([
    ["q1", { subject: "Physics", chapter: "Kinematics" }],
    ["q2", { subject: "physics", chapter: "Kinematics" }],
    ["q3", { subject: "physics", chapter: null }],
    ["q4", { subject: null, chapter: "x" }],
  ]);
  const out = aggregatePractice(
    [
      { questionId: "q1", isCorrect: false },
      { questionId: "q1", isCorrect: true },
      { questionId: "q2", isCorrect: false },
      { questionId: "q3", isCorrect: true },
      { questionId: "q4", isCorrect: true },
      { questionId: "missing", isCorrect: true },
    ],
    questions,
  );
  assert.equal(out.length, 1);
  assert.deepEqual({ ...out[0], chapters: undefined }, { subject: "physics", attempted: 3, solved: 2, accuracy: 0.5, chapters: undefined });
  assert.deepEqual(out[0].chapters.map((c) => [c.chapter, c.attempted, c.solved]), [["Kinematics", 2, 1], ["Other", 1, 1]]);
});

// Home activity (daily missions + week chart). NOW = 25/10/2026 10:00 IST.
const NOW = Date.parse("2026-10-25T04:30:00Z");
const at = (iso: string, questionId: string, isCorrect = true) => ({ questionId, isCorrect, createdAt: iso });

test("activity counts distinct questions per IST day, today last", () => {
  const out = summarizeActivity(
    [
      at("2026-10-25T01:00:00Z", "q1"),
      at("2026-10-25T02:00:00Z", "q1"), // same question again: still one
      at("2026-10-25T03:00:00Z", "q2", false),
      at("2026-10-24T10:00:00Z", "q3"),
    ],
    null,
    NOW,
  );
  assert.equal(out.week.length, 7);
  assert.equal(out.week[6].date, "2026-10-25");
  assert.deepEqual({ attempted: out.today.attempted, solved: out.today.solved }, { attempted: 2, solved: 1 });
  assert.equal(out.week[5].date, "2026-10-24");
  assert.equal(out.week[5].solved, 1);
  assert.equal(out.week[0].date, "2026-10-19");
});

test("activity uses the IST day, not UTC", () => {
  // 24/10 20:00 UTC is 25/10 01:30 IST: today, not yesterday.
  const out = summarizeActivity([at("2026-10-24T20:00:00Z", "q1")], null, NOW);
  assert.equal(out.today.solved, 1);
  assert.equal(out.week[5].solved, 0);
});

test("challenge is done only when today's question was finished today", () => {
  assert.equal(summarizeActivity([at("2026-10-25T01:00:00Z", "qotd", false)], "qotd", NOW).today.challengeDone, true);
  assert.equal(summarizeActivity([at("2026-10-24T01:00:00Z", "qotd")], "qotd", NOW).today.challengeDone, false);
  assert.equal(summarizeActivity([at("2026-10-25T01:00:00Z", "other")], "qotd", NOW).today.challengeDone, false);
  assert.equal(summarizeActivity([at("2026-10-25T01:00:00Z", "qotd")], null, NOW).today.challengeDone, false);
});

test("previous week sums the 7 days before the chart; older and bad rows are ignored", () => {
  const out = summarizeActivity(
    [
      at("2026-10-18T06:00:00Z", "a"), // day 8 back: previous week
      at("2026-10-12T06:00:00Z", "b"), // day 14 back: previous week
      at("2026-10-11T06:00:00Z", "c"), // 15 back: ignored
      at("not a date", "d"),
      at("2026-10-18T06:00:00Z", "e", false), // wrong: not solved
    ],
    null,
    NOW,
  );
  assert.equal(out.previousWeekSolved, 2);
  assert.equal(out.week.reduce((n, d) => n + d.attempted, 0), 0);
});

test("no attempts: a zeroed week", () => {
  const out = summarizeActivity([], "qotd", NOW);
  assert.deepEqual(out.today, { date: "2026-10-25", attempted: 0, solved: 0, challengeDone: false });
  assert.equal(out.previousWeekSolved, 0);
});

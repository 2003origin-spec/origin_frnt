/**
 * Mock-test attempts are mirrored on-device so Back / refresh / a WebView
 * crash never loses them. These are the pure halves of that mirror.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TEST_DRAFT_GRACE_MS,
  TEST_MAX_VIOLATIONS,
  classifyRestoredDraft,
  clearTestDraft,
  countAnswered,
  loadTestDraft,
  parseTestDraft,
  remainingSecondsFrom,
  saveTestDraft,
  testDraftKey,
  type DraftStorage,
} from "@/lib/tests/test-draft";
import type { UserAnswer } from "@/types";

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const ids = ["q1", "q2", "q3"];
const blank = (id: string): UserAnswer => ({ questionId: id, selectedOption: null, timeSpent: 0, isMarkedForReview: false });
const answers: UserAnswer[] = [{ ...blank("q1"), selectedOption: 2, timeSpent: 40 }, blank("q2"), { ...blank("q3"), isMarkedForReview: true }];

test("keys are per user, paper and sitting", () => {
  assert.notEqual(testDraftKey("u1", "t1"), testDraftKey("u2", "t1"));
  assert.notEqual(testDraftKey("u1", "t1"), testDraftKey("u1", "t2"));
  assert.notEqual(testDraftKey("u1", "t1", "room-a"), testDraftKey("u1", "t1", "room-b"));
});

test("save → load round-trips answers, marks, position and start time", () => {
  const s = memoryStorage();
  const key = testDraftKey("u1", "t1");
  saveTestDraft(s, key, { questionIds: ids, answers, visited: [true, true, false], currentIndex: 1, startedAtMs: 1_000, durationSeconds: 600 }, 5_000);
  const d = loadTestDraft(s, key, ids, 6_000);
  assert.ok(d);
  assert.deepEqual(d.answers, answers);
  assert.deepEqual(d.visited, [true, true, false]);
  assert.equal(d.currentIndex, 1);
  assert.equal(d.startedAtMs, 1_000);
  assert.equal(countAnswered(d.answers), 1);
  clearTestDraft(s, key);
  assert.equal(loadTestDraft(s, key, ids, 6_000), null);
});

test("a draft for a different paper, a corrupt one, or a long-abandoned one is dropped", () => {
  const s = memoryStorage();
  const key = testDraftKey("u1", "t1");
  saveTestDraft(s, key, { questionIds: ids, answers, visited: [], currentIndex: 0, startedAtMs: 0, durationSeconds: 60 }, 0);
  assert.equal(loadTestDraft(s, key, ["q1", "q2", "qX"], 1), null);
  assert.equal(s.map.size, 0, "mismatched draft is removed");

  assert.equal(parseTestDraft("{not json", ids, 0), null);
  const raw = JSON.stringify({ v: 1, questionIds: ids, answers, visited: [], currentIndex: 9, startedAtMs: 0, durationSeconds: 60 });
  assert.equal(parseTestDraft(raw, ids, 60_000 + TEST_DRAFT_GRACE_MS + 1), null);
  const kept = parseTestDraft(raw, ids, 60_000 + 1);
  assert.ok(kept);
  assert.equal(kept.currentIndex, 2, "index clamped into the paper");
});

test("remaining time keeps counting from the wall-clock start", () => {
  assert.equal(remainingSecondsFrom(0, 600, 0), 600);
  assert.equal(remainingSecondsFrom(0, 600, 59_500), 541);
  assert.equal(remainingSecondsFrom(0, 600, 700_000), 0);
  assert.equal(remainingSecondsFrom(10_000, 600, 0), 600, "a start in the future never adds time");
});

test("throwing storage is swallowed", () => {
  const bad: DraftStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("quota"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.equal(loadTestDraft(bad, "k", ids, 0), null);
  assert.doesNotThrow(() => saveTestDraft(bad, "k", { questionIds: ids, answers, visited: [], currentIndex: 0, startedAtMs: 0, durationSeconds: 1 }, 0));
  assert.doesNotThrow(() => clearTestDraft(bad, "k"));
  assert.equal(loadTestDraft(null, "k", ids, 0), null);
});

test("malpractice strikes survive leave + reopen (no free counter reset)", () => {
  const s = memoryStorage();
  const key = testDraftKey("u1", "t1");
  const base = { questionIds: ids, answers, visited: [true, false, false], currentIndex: 0, startedAtMs: 1_000, durationSeconds: 600 };
  saveTestDraft(s, key, { ...base, violations: 2 }, 5_000);
  const d = loadTestDraft(s, key, ids, 6_000);
  assert.ok(d);
  assert.equal(d.violations, 2);
  assert.equal(d.terminated, false);

  saveTestDraft(s, key, { ...base, violations: 3, terminated: true }, 7_000);
  const t = loadTestDraft(s, key, ids, 8_000);
  assert.ok(t);
  assert.equal(t.terminated, true);
  assert.equal(classifyRestoredDraft(t, { selfTimed: true, nowMs: 8_000 }), "terminated");
});

test("strike counts are clamped, and an old draft without them restores at 0", () => {
  const raw = (extra: Record<string, unknown>) =>
    JSON.stringify({ v: 1, questionIds: ids, answers, visited: [], currentIndex: 0, startedAtMs: 1_000, durationSeconds: 600, ...extra });
  assert.equal(parseTestDraft(raw({}), ids, 2_000)?.violations, 0);
  assert.equal(parseTestDraft(raw({}), ids, 2_000)?.terminated, false);
  assert.equal(parseTestDraft(raw({ violations: -4 }), ids, 2_000)?.violations, 0);
  const many = parseTestDraft(raw({ violations: 99 }), ids, 2_000);
  assert.equal(many?.violations, TEST_MAX_VIOLATIONS);
  assert.equal(many?.terminated, true, "3+ strikes is a terminated attempt");
});

test("an expired self-timed draft is the student's choice, never an instant submit", () => {
  const draft = { startedAtMs: 0, durationSeconds: 600, terminated: false };
  assert.equal(classifyRestoredDraft(draft, { selfTimed: true, nowMs: 300_000 }), "resume");
  assert.equal(classifyRestoredDraft(draft, { selfTimed: true, nowMs: 600_000 }), "expired");
  assert.equal(classifyRestoredDraft(draft, { selfTimed: true, nowMs: 2 * 60 * 60 * 1000 }), "expired");
  // A room test runs on the server clock: when that says time is over it submits as before.
  assert.equal(classifyRestoredDraft(draft, { selfTimed: false, nowMs: 2 * 60 * 60 * 1000 }), "resume");
});

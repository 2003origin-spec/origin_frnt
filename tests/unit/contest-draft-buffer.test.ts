/**
 * Contest autosave draft rev-LWW unit tests (Phase 1). The load-bearing case:
 * an out-of-order / stale write (rev ≤ stored) is rejected so a laggy tab can
 * never clobber a newer draft; a higher rev wins; oversized payloads 413.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTEST_DRAFT_MAX_BYTES,
  decideDraftWrite,
  draftDirtySetKey,
  draftKey,
} from "@/lib/contest/draft-buffer";

test("first write (no stored rev) is accepted", () => {
  const d = decideDraftWrite({ answers: { "1": "A" }, rev: 1 }, null);
  assert.equal(d.ok, true);
  if (d.ok) {
    assert.equal(d.draft.rev, 1);
    assert.deepEqual(d.draft.answers, { "1": "A" });
    // missing palette/times default to {}
    assert.deepEqual(d.draft.palette, {});
    assert.deepEqual(d.draft.times, {});
  }
});

test("a higher rev wins (LWW)", () => {
  const d = decideDraftWrite({ answers: { "1": "B" }, rev: 5 }, 4);
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.draft.rev, 5);
});

test("an equal or lower rev is rejected as stale (409)", () => {
  const equal = decideDraftWrite({ rev: 4 }, 4);
  assert.equal(equal.ok, false);
  if (!equal.ok) {
    assert.equal(equal.code, 409);
    assert.equal(equal.reason, "stale_draft");
  }
  const lower = decideDraftWrite({ rev: 2 }, 7);
  assert.equal(lower.ok, false);
  if (!lower.ok) assert.equal(lower.code, 409);
});

test("out-of-order interleave converges to the highest rev", () => {
  // simulate applying {5,3,7,6} against a running stored rev
  let stored: number | null = null;
  for (const rev of [5, 3, 7, 6]) {
    const d = decideDraftWrite({ rev }, stored);
    if (d.ok) stored = d.draft.rev;
  }
  assert.equal(stored, 7);
});

test("a non-positive / non-integer rev is rejected (400)", () => {
  for (const rev of [0, -1, NaN, "x", undefined]) {
    const d = decideDraftWrite({ rev }, null);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, 400);
  }
});

test("oversized answers/palette payload is rejected (413)", () => {
  const big: Record<string, string> = {};
  // build a > 64KB answers map
  for (let i = 0; i < 5000; i += 1) big[`q${i}`] = "x".repeat(20);
  assert.ok(Buffer.byteLength(JSON.stringify(big), "utf8") > CONTEST_DRAFT_MAX_BYTES);
  const d = decideDraftWrite({ answers: big, rev: 1 }, null);
  assert.equal(d.ok, false);
  if (!d.ok) assert.equal(d.code, 413);
});

test("keys are namespaced per contest + attempt", () => {
  assert.equal(draftKey("c1", "u1"), "contest:c1:draft:u1");
  assert.equal(draftDirtySetKey("c1"), "contest:c1:draft:dirty");
});

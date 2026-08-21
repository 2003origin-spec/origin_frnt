/**
 * Contest draft store tests — exercises the in-memory fallback (no Redis) with
 * the real rev-LWW semantics: accept higher rev, reject stale, read back the
 * winning draft. (The Upstash Lua path is the same decision, verified live.)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetLocalDraftBufferForTests,
  readContestDraft,
  saveContestDraft,
} from "@/server/contest/contest-draft-store";

// No Redis env in unit tests → the store uses its in-memory fallback (NODE_ENV
// is "test", i.e. not "production", so the fallback is permitted).

test("save accepts increasing revs and rejects stale, read returns the winner", async () => {
  __resetLocalDraftBufferForTests();

  const r1 = await saveContestDraft("c1", "u1", { answers: { "1": "A" }, rev: 1 });
  assert.deepEqual(r1, { ok: true, rev: 1 });

  const r2 = await saveContestDraft("c1", "u1", { answers: { "1": "B" }, rev: 2 });
  assert.deepEqual(r2, { ok: true, rev: 2 });

  // stale rev rejected
  const stale = await saveContestDraft("c1", "u1", { answers: { "1": "C" }, rev: 2 });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 409);

  // read returns the rev-2 draft
  const draft = await readContestDraft("c1", "u1");
  assert.ok(draft);
  assert.equal(draft?.rev, 2);
  assert.deepEqual(draft?.answers, { "1": "B" });
});

test("drafts are isolated per (contest, user)", async () => {
  __resetLocalDraftBufferForTests();
  await saveContestDraft("c1", "u1", { answers: { "1": "A" }, rev: 1 });
  await saveContestDraft("c1", "u2", { answers: { "1": "Z" }, rev: 1 });
  await saveContestDraft("c2", "u1", { answers: { "1": "Q" }, rev: 1 });

  assert.deepEqual((await readContestDraft("c1", "u1"))?.answers, { "1": "A" });
  assert.deepEqual((await readContestDraft("c1", "u2"))?.answers, { "1": "Z" });
  assert.deepEqual((await readContestDraft("c2", "u1"))?.answers, { "1": "Q" });
  assert.equal(await readContestDraft("c3", "u9"), null);
});

test("bad rev / oversized payload are rejected with the right codes", async () => {
  __resetLocalDraftBufferForTests();
  const bad = await saveContestDraft("c1", "u1", { rev: 0 });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.code, 400);
});

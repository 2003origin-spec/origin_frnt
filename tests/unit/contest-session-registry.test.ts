/**
 * Single-active-session registry tests (in-memory fallback). Newest claim wins;
 * older session is evicted; unset/unknown is fail-open (allowed).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetSessionRegistryForTests,
  claimActiveSession,
  isActiveSession,
} from "@/server/contest/contest-session-registry";

test("no claim yet → any session is allowed (fail-open)", async () => {
  __resetSessionRegistryForTests();
  assert.equal(await isActiveSession("c1", "u1", "sidA"), true);
});

test("the claiming session is active; a stale one is evicted", async () => {
  __resetSessionRegistryForTests();
  await claimActiveSession("c1", "u1", "sidA");
  assert.equal(await isActiveSession("c1", "u1", "sidA"), true);
  assert.equal(await isActiveSession("c1", "u1", "sidB"), false);
});

test("a newer claim supersedes the older session", async () => {
  __resetSessionRegistryForTests();
  await claimActiveSession("c1", "u1", "sidA");
  await claimActiveSession("c1", "u1", "sidB"); // new tab/device
  assert.equal(await isActiveSession("c1", "u1", "sidB"), true);
  assert.equal(await isActiveSession("c1", "u1", "sidA"), false); // old tab evicted
});

test("sessions are isolated per (contest, user)", async () => {
  __resetSessionRegistryForTests();
  await claimActiveSession("c1", "u1", "sidA");
  await claimActiveSession("c2", "u1", "sidZ");
  assert.equal(await isActiveSession("c1", "u1", "sidA"), true);
  assert.equal(await isActiveSession("c2", "u1", "sidA"), false);
  // different user, no claim → allowed
  assert.equal(await isActiveSession("c1", "u2", "sidQ"), true);
});

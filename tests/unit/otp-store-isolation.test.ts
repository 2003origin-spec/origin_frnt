/**
 * Regression guard for the 2026-08-03 "Invalid verification code" incident.
 *
 * OTPs used to be a collection inside the fully-hydrated AppStore. Every
 * `withStoreAsync()` — 65 call sites across 20 modules, on ordinary paths like
 * task edits — persists the WHOLE store, and `replaceCollection()` issues
 * `DELETE FROM app.<table>` with no WHERE before re-inserting one serverless
 * instance's snapshot. A request holding a snapshot from before a code was
 * issued therefore DELETED that freshly-minted OTP and restored its stale copy,
 * so the user typed the code they were emailed and was told it was invalid.
 *
 * `app.otps` must never come back under that wholesale delete.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { collectionTables } from "../../src/server/store-postgres";

test("app.otps is NOT owned by the full-store persist", () => {
  const tables = collectionTables();
  assert.ok(tables.length > 0, "sanity: the store still owns some collections");
  assert.ok(
    !tables.includes("otps"),
    "otps must stay out of COLLECTION_SPECS — persistStoreToPostgres DELETEs " +
      "each of these tables in full, which destroys in-flight login codes",
  );
});

test("the collections that remain are still wholesale-rewritten", () => {
  // Documents the blast radius that still exists for everything else, so the
  // next person knows this class of lost update is not solved in general.
  const tables = collectionTables();
  for (const expected of ["streaks", "daily_activities", "user_scores", "test_results"]) {
    assert.ok(tables.includes(expected), `${expected} is still a store-owned collection`);
  }
});

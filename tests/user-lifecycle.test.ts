/**
 * Feature B — admin user lifecycle (schema/primitives). Pure-logic tests for the
 * blocklist identity normalizers. DB-backed blocklist/status paths are covered by
 * integration tests.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeEmailForBlock,
  normalizeMobileForBlock,
} from "../src/server/user-lifecycle-store";

test("normalizeEmailForBlock lowercases + trims, null when empty", () => {
  assert.equal(normalizeEmailForBlock("  Foo@Bar.COM "), "foo@bar.com");
  assert.equal(normalizeEmailForBlock(""), null);
  assert.equal(normalizeEmailForBlock(null), null);
  assert.equal(normalizeEmailForBlock(undefined), null);
});

test("normalizeMobileForBlock yields the 10-digit form (matching signup)", () => {
  assert.equal(normalizeMobileForBlock("9876543210"), "9876543210");
  assert.equal(normalizeMobileForBlock("+91 98765 43210"), "9876543210");
  assert.equal(normalizeMobileForBlock("919876543210"), "9876543210");
});

test("normalizeMobileForBlock rejects invalid numbers", () => {
  assert.equal(normalizeMobileForBlock("12345"), null); // too short
  assert.equal(normalizeMobileForBlock("5876543210"), null); // must start 6-9
  assert.equal(normalizeMobileForBlock(null), null);
  assert.equal(normalizeMobileForBlock(""), null);
});

/**
 * Phase 2 — pure parts of the idempotency contract (no database needed).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  IdempotencyConflictError,
  hashRequest,
  normalizeIdempotencyKey,
  stableStringify,
} from "../../src/server/payments/idempotency";

test("stableStringify is key-order independent at every depth", () => {
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
  assert.equal(
    stableStringify({ x: { p: 1, q: [1, { m: 1, n: 2 }] } }),
    stableStringify({ x: { q: [1, { n: 2, m: 1 }], p: 1 } }),
  );
});

test("stableStringify preserves ARRAY order — order is meaningful there", () => {
  assert.notEqual(stableStringify({ s: ["a", "b"] }), stableStringify({ s: ["b", "a"] }));
});

test("stableStringify ignores undefined but not null", () => {
  assert.equal(stableStringify({ a: 1, b: undefined }), stableStringify({ a: 1 }));
  assert.notEqual(stableStringify({ a: 1, b: null }), stableStringify({ a: 1 }));
});

test("a retry that reserialises its body in a different order is NOT a mismatch", () => {
  // The real-world case this protects: a client rebuilds the JSON on retry and
  // the key order differs. Without stable hashing the user would get a 422.
  const a = hashRequest("/api/payments/checkout", { subject: "physics", termMonths: 3 });
  const b = hashRequest("/api/payments/checkout", { termMonths: 3, subject: "physics" });
  assert.equal(a, b);
});

test("a genuinely different body produces a different hash", () => {
  const base = hashRequest("/api/payments/checkout", { subject: "physics", termMonths: 1 });
  assert.notEqual(base, hashRequest("/api/payments/checkout", { subject: "physics", termMonths: 12 }));
  assert.notEqual(base, hashRequest("/api/payments/checkout", { subject: "chemistry", termMonths: 1 }));
  // Same body, different endpoint must not collide either.
  assert.notEqual(base, hashRequest("/api/payments/verify", { subject: "physics", termMonths: 1 }));
});

test("normalizeIdempotencyKey accepts sane keys and trims", () => {
  assert.equal(normalizeIdempotencyKey("abc-123"), "abc-123");
  assert.equal(normalizeIdempotencyKey("  abc_123.x:y  "), "abc_123.x:y");
  // A UUID is what a browser will actually send (crypto.randomUUID()).
  const uuid = randomUUID();
  assert.equal(normalizeIdempotencyKey(uuid), uuid);
  // 200 chars is the documented ceiling and must be inclusive.
  assert.equal(normalizeIdempotencyKey("k".repeat(200))?.length, 200);
});

test("normalizeIdempotencyKey returns null when the header is absent or blank", () => {
  assert.equal(normalizeIdempotencyKey(null), null);
  assert.equal(normalizeIdempotencyKey(undefined), null);
  assert.equal(normalizeIdempotencyKey("   "), null);
});

test("normalizeIdempotencyKey rejects oversized and unprintable keys", () => {
  assert.throws(() => normalizeIdempotencyKey("x".repeat(201)), IdempotencyConflictError);
  for (const bad of ["has space", "semi;colon", "new\nline", "quote\"", "sl/ash", "emoji😀"]) {
    assert.throws(() => normalizeIdempotencyKey(bad), IdempotencyConflictError, `should reject ${JSON.stringify(bad)}`);
  }
});

test("key-validation failures are 400, not 5xx", () => {
  try {
    normalizeIdempotencyKey("bad key");
    assert.fail("should have thrown");
  } catch (error) {
    assert.ok(error instanceof IdempotencyConflictError);
    assert.equal(error.status, 400);
  }
});

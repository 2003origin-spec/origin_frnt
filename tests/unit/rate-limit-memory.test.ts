/**
 * Rate-limit fallback + fail-closed policy (BUG_FIX_PLAN.md A2 / N24).
 * The load-bearing cases: with no Upstash the limiter is a real per-instance
 * sliding window (the old no-op allowed everything), and a backend error on a
 * fail-closed limiter DENIES instead of allowing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createMemoryLimiter,
  isLockedOut,
  isWithinLimit,
  resetLimit,
  windowToMs,
  type AppRateLimiter,
} from "@/lib/rate-limit";

test("windowToMs parses the Upstash duration strings", () => {
  assert.equal(windowToMs("60 s"), 60_000);
  assert.equal(windowToMs("10 m"), 600_000);
  assert.equal(windowToMs("1 h"), 3_600_000);
  assert.equal(windowToMs("1 d"), 86_400_000);
  assert.throws(() => windowToMs("fortnight" as never));
});

test("memory limiter denies the (limit+1)th hit inside the window and frees it after", async () => {
  let t = 1_000_000;
  const limiter = createMemoryLimiter(2, 10_000, {}, () => t);
  assert.equal((await limiter.limit("a")).success, true);
  assert.equal((await limiter.limit("a")).success, true);
  const third = await limiter.limit("a");
  assert.equal(third.success, false);
  assert.equal(third.remaining, 0);
  // a different identifier has its own budget
  assert.equal((await limiter.limit("b")).success, true);
  // window slides: 10 s later the first two hits have aged out
  t += 10_001;
  assert.equal((await limiter.limit("a")).success, true);
});

test("remaining() reports the budget without consuming it", async () => {
  const limiter = createMemoryLimiter(3, 60_000);
  assert.equal(await limiter.remaining("x"), 3);
  await limiter.limit("x");
  assert.equal(await limiter.remaining("x"), 2);
  assert.equal(await limiter.remaining("x"), 2);
  await limiter.limit("x");
  await limiter.limit("x");
  assert.equal(await isLockedOut(limiter, "x"), true);
  assert.equal(await isLockedOut(limiter, "y"), false);
});

function throwingLimiter(failClosed: boolean): AppRateLimiter {
  return {
    failClosed,
    async limit() {
      throw new Error("upstash down");
    },
    async remaining() {
      throw new Error("upstash down");
    },
    async reset() {
      throw new Error("upstash down");
    },
  };
}

test("backend error: fail-open limiter allows, fail-closed limiter denies", async () => {
  assert.equal(await isWithinLimit(throwingLimiter(false), "id"), true);
  assert.equal(await isWithinLimit(throwingLimiter(true), "id"), false);
  // the per-call option overrides the limiter's own policy either way
  assert.equal(await isWithinLimit(throwingLimiter(false), "id", { failClosed: true }), false);
  assert.equal(await isWithinLimit(throwingLimiter(true), "id", { failClosed: false }), true);
});

test("lockout read is fail-open (the gate's isWithinLimit is what fails closed)", async () => {
  assert.equal(await isLockedOut(throwingLimiter(true), "id"), false);
});

test("reset() clears one identifier's hits and leaves the others", async () => {
  const limiter = createMemoryLimiter(2, 60_000);
  await limiter.limit("a");
  await limiter.limit("a");
  await limiter.limit("b");
  assert.equal(await isLockedOut(limiter, "a"), true);
  await limiter.reset("a");
  assert.equal(await limiter.remaining("a"), 2);
  assert.equal(await limiter.remaining("b"), 1);
});

test("resetLimit never throws on a backend error", async () => {
  await resetLimit(throwingLimiter(true), "id");
});

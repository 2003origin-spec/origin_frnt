/**
 * Phase 2 — pricing snapshot cache + term maths.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  PRICING_CACHE_KEY,
  amountForTerm,
  getCachedPricing,
  invalidatePricingCache,
  type PricingSnapshot,
} from "../../src/server/payments/pricing-cache";
import {
  __resetPaymentsRedisForTests,
  __setPaymentsRedisForTests,
  type PaymentsRedis,
} from "../../src/server/payments/payments-redis";

function fakeRedis() {
  const store = new Map<string, string>();
  const redis: PaymentsRedis = {
    async get(key) { return store.get(key) ?? null; },
    async set(key, value) { store.set(key, value); return "OK"; },
    async del(...keys) { let n = 0; for (const k of keys) if (store.delete(k)) n += 1; return n; },
  };
  return { redis, store };
}

const SNAPSHOT: PricingSnapshot = {
  subjects: [{ subject: "physics", amountMinor: 49900, listAmountMinor: 99900 }],
  bundle: null,
  terms: [{ termMonths: 1, label: "Monthly", discountPercent: 0 }],
  currency: "INR",
};

test("a warm cache serves without calling the loader", async () => {
  const { redis } = fakeRedis();
  __setPaymentsRedisForTests(redis);
  try {
    let loads = 0;
    const loader = async () => { loads += 1; return SNAPSHOT; };
    assert.deepEqual(await getCachedPricing(loader), SNAPSHOT);
    assert.deepEqual(await getCachedPricing(loader), SNAPSHOT);
    assert.equal(loads, 1, "second read came from cache");
  } finally { __setPaymentsRedisForTests(null); }
});

test("an admin write invalidates, so the next student load sees the new price", async () => {
  const { redis } = fakeRedis();
  __setPaymentsRedisForTests(redis);
  try {
    let price = 49900;
    const loader = async (): Promise<PricingSnapshot> => ({
      ...SNAPSHOT,
      subjects: [{ subject: "physics", amountMinor: price, listAmountMinor: null }],
    });

    assert.equal((await getCachedPricing(loader)).subjects[0].amountMinor, 49900);
    price = 59900; // admin edits the price
    assert.equal(
      (await getCachedPricing(loader)).subjects[0].amountMinor,
      49900,
      "still stale until invalidated",
    );

    await invalidatePricingCache();
    assert.equal(
      (await getCachedPricing(loader)).subjects[0].amountMinor,
      59900,
      "new price visible immediately after invalidation",
    );
  } finally { __setPaymentsRedisForTests(null); }
});

test("no Redis ⇒ always loads fresh, never throws", async () => {
  __setPaymentsRedisForTests(null);
  let loads = 0;
  const loader = async () => { loads += 1; return SNAPSHOT; };
  assert.deepEqual(await getCachedPricing(loader), SNAPSHOT);
  assert.deepEqual(await getCachedPricing(loader), SNAPSHOT);
  assert.equal(loads, 2, "degrades to no caching");
  await invalidatePricingCache(); // must not throw
});

test("a Redis outage mid-flight degrades instead of failing the page", async () => {
  const broken: PaymentsRedis = {
    async get() { throw new Error("upstash down"); },
    async set() { throw new Error("upstash down"); },
    async del() { throw new Error("upstash down"); },
  };
  __setPaymentsRedisForTests(broken);
  try {
    assert.deepEqual(await getCachedPricing(async () => SNAPSHOT), SNAPSHOT);
    await invalidatePricingCache();
  } finally { __setPaymentsRedisForTests(null); }
});

test("a stale blob from an older deploy is rejected, not rendered", async () => {
  const { redis, store } = fakeRedis();
  __setPaymentsRedisForTests(redis);
  try {
    // An old deploy cached a snapshot with no `terms`; rendering it would give
    // a pricing page with no buy buttons.
    store.set(PRICING_CACHE_KEY, JSON.stringify({ subjects: [], bundle: null, currency: "INR" }));
    let loads = 0;
    const result = await getCachedPricing(async () => { loads += 1; return SNAPSHOT; });
    assert.equal(loads, 1, "incompatible blob was ignored and reloaded");
    assert.deepEqual(result, SNAPSHOT);
  } finally { __setPaymentsRedisForTests(null); }
});

test("term maths matches the seeded ladder exactly", () => {
  const monthly = { termMonths: 1, label: "Monthly", discountPercent: 0 };
  const quarter = { termMonths: 3, label: "3 months", discountPercent: 10 };
  const annual = { termMonths: 12, label: "12 months", discountPercent: 25 };

  // Subject at ₹499/mo (the current production price).
  assert.equal(amountForTerm(49900, monthly), 49900);
  assert.equal(amountForTerm(49900, quarter), 134700); // ₹1,347
  assert.equal(amountForTerm(49900, annual), 449100); // ₹4,491

  // Bundle at ₹1,499/mo.
  assert.equal(amountForTerm(149900, monthly), 149900);
  assert.equal(amountForTerm(149900, annual), 1349100);
});

test("no price ever renders with paise", () => {
  const odd = { termMonths: 3, label: "3 months", discountPercent: 7 };
  for (const monthly of [49900, 33300, 99900, 12345, 1, 777]) {
    assert.equal(amountForTerm(monthly, odd) % 100, 0, `₹${monthly / 100} left paise`);
  }
});

test("a 100%-off term cannot produce a negative amount", () => {
  assert.equal(amountForTerm(49900, { termMonths: 12, label: "x", discountPercent: 90 }), 59900);
  assert.equal(amountForTerm(0, { termMonths: 3, label: "x", discountPercent: 10 }), 0);
});

test("cleanup", () => { __resetPaymentsRedisForTests(); });

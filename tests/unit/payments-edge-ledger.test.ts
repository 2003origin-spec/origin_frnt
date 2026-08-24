/**
 * The §7 edge-case ledger, made machine-checkable.
 *
 * V1/RAZORPAY_PAYMENTS_PLAN.md §7 lists 56 failure modes this design is
 * *required* to survive. A markdown table cannot tell you whether the mitigation
 * it promises is still there, so this file mirrors the ledger as data: every
 * E-number names the test that actually holds the line, and a meta-test asserts
 * that each of those files exists and that no number went missing. Delete a
 * covering suite and this fails; add an edge case without a test and this fails.
 *
 * The plan itself lives at the monorepo root, outside this app and outside the
 * Vercel deploy repo, so it deliberately is NOT parsed here — the map below is
 * the app-side copy of the contract, and §7 is its prose counterpart.
 *
 * Cases whose owner is `THIS_FILE` are asserted below; the DB-backed ones live
 * in tests/integration/payments-edge-cases.test.ts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ALL_FLAG_KEYS, isFeatureEnabled } from "@/lib/feature-flags";
import {
  paymentsCheckoutIpLimiter,
  paymentsCheckoutLimiter,
  paymentsCouponFailureLimiter,
  paymentsCouponLimiter,
} from "@/lib/rate-limit";
import { getApiRoutePolicy, getAppRoutePolicy } from "@/server/route-policy";

const root = new URL("../..", import.meta.url).pathname;

const THIS_FILE = "tests/unit/payments-edge-ledger.test.ts";
const EDGE_CASES = "tests/integration/payments-edge-cases.test.ts";
const IDEMPOTENCY = "tests/integration/payments-idempotency.test.ts";
const STORE = "tests/integration/payments-store.test.ts";
const RAIL_A = "tests/integration/payments-rail-a.test.ts";
const ACCEPTANCE = "tests/integration/payments-acceptance.test.ts";
const PHASE5 = "tests/integration/payments-phase5.test.ts";
const PHASE6 = "tests/integration/payments-phase6.test.ts";
const PHASE7 = "tests/integration/payments-phase7.test.ts";
const PHASE8 = "tests/integration/payments-phase8.test.ts";
const UNIT_PHASE7 = "tests/unit/payments-phase7.test.ts";
const UNIT_CLIENT = "tests/unit/payments-razorpay-client.test.ts";
const UNIT_GRANTS = "tests/unit/payments-grants.test.ts";
const UNIT_OUTBOX = "tests/unit/payments-outbox.test.ts";
const UNIT_QSTASH = "tests/unit/payments-qstash.test.ts";
const UNIT_PRICING = "tests/unit/payments-pricing-cache.test.ts";
const UNIT_FINANCIALS = "tests/unit/payments-financials.test.ts";
const CRON_MANIFEST = "tests/cron-manifest.test.ts";
/** Ops-only: no code path exists to assert. Verified by a human at cutover. */
const OPS = "ops";

const LEDGER: Record<string, { what: string; covered: readonly string[] }> = {
  E1:  { what: "double-tap creates two orders", covered: [IDEMPOTENCY, STORE] },
  E2:  { what: "same key, different body", covered: [IDEMPOTENCY] },
  E3:  { what: "Redis down", covered: [IDEMPOTENCY] },
  E4:  { what: "Razorpay 5xx at orders.create", covered: [RAIL_A] },
  E5:  { what: "orphan Razorpay order healed by reconcile", covered: [EDGE_CASES, PHASE7] },
  E6:  { what: "client tampers with the amount", covered: [EDGE_CASES, UNIT_CLIENT] },
  E7:  { what: "price changes between render and pay", covered: [EDGE_CASES] },
  E8:  { what: "student already owns the subject", covered: [UNIT_GRANTS, PHASE7] },
  E9:  { what: "bundle bought with one subject owned", covered: [EDGE_CASES, PHASE5] },
  E10: { what: "coupon makes the total zero", covered: [RAIL_A] },
  E11: { what: "non-INR currency", covered: [EDGE_CASES] },
  E12: { what: "order spam against Razorpay", covered: [THIS_FILE] },
  E13: { what: "Android in-app purchase attempt", covered: [THIS_FILE] },
  E14: { what: "two students take the last coupon unit", covered: [ACCEPTANCE, PHASE5] },
  E15: { what: "abandoned checkout burns per_user_limit", covered: [ACCEPTANCE, PHASE7] },
  E16: { what: "coupon expires between order and capture", covered: [EDGE_CASES] },
  E17: { what: "coupon disabled mid-checkout", covered: [EDGE_CASES] },
  E18: { what: "two coupon codes stacked", covered: [THIS_FILE] },
  E19: { what: "percent coupon over 100 or negative", covered: [EDGE_CASES, UNIT_PRICING] },
  E20: { what: "plan explosion from coupon-priced subscriptions", covered: [ACCEPTANCE] },
  E21: { what: "duplicate webhook delivery", covered: [STORE] },
  E22: { what: "missing x-razorpay-event-id header", covered: [THIS_FILE] },
  E23: { what: "bad webhook HMAC signature", covered: [UNIT_CLIENT] },
  E24: { what: "live key with test webhook secret", covered: [UNIT_CLIENT] },
  E25: { what: "webhook arrives before the order row", covered: [EDGE_CASES] },
  E26: { what: "payment.captured and order.paid both fire", covered: [STORE, RAIL_A] },
  E27: { what: "events out of order", covered: [PHASE6] },
  E28: { what: "replay of an old validly-signed body", covered: [UNIT_PHASE7] },
  E29: { what: "webhook URL never registered", covered: [STORE, PHASE8] },
  E30: { what: "cold start past Razorpay's 5s timeout", covered: [THIS_FILE] },
  E31: { what: "Neon connection exhaustion in a burst", covered: [STORE] },
  E32: { what: "webhook for a deleted user", covered: [PHASE6] },
  E33: { what: "concurrent webhook and client verify", covered: [ACCEPTANCE] },
  E34: { what: "mail provider down when the receipt sends", covered: [UNIT_OUTBOX] },
  E35: { what: "QStash not provisioned", covered: [UNIT_QSTASH] },
  E36: { what: "QStash delivers twice", covered: [STORE] },
  E37: { what: "QStash signature invalid", covered: [UNIT_QSTASH] },
  E38: { what: "outbox row poisons the queue", covered: [STORE] },
  E39: { what: "student pays and sees no unlock", covered: [RAIL_A, PHASE7, CRON_MANIFEST] },
  E40: { what: "refund issued from the Razorpay dashboard", covered: [STORE, PHASE7] },
  E41: { what: "partial refund keeps access", covered: [PHASE7, UNIT_PHASE7] },
  E42: { what: "chargeback or dispute", covered: [PHASE7, PHASE8] },
  E43: { what: "payment.failed", covered: [STORE, RAIL_A] },
  E44: { what: "subscription mandate fails", covered: [PHASE7, UNIT_PHASE7] },
  E45: { what: "subscription.cancelled keeps access to period end", covered: [PHASE6] },
  E46: { what: "subscriptions never flip to expired", covered: [PHASE7] },
  E47: { what: "account deleted with an active subscription", covered: [PHASE7] },
  E48: { what: "bundle contents changed after purchase", covered: [ACCEPTANCE, PHASE5] },
  E49: { what: "test payments polluting revenue", covered: [PHASE8, UNIT_FINANCIALS] },
  E50: { what: "migration fails at build", covered: [THIS_FILE] },
  E51: { what: "deploy lands mid-checkout", covered: [THIS_FILE] },
  E52: { what: "need to roll back a phase", covered: [THIS_FILE] },
  E53: { what: "function timeout during the drain", covered: [STORE] },
  E54: { what: "monorepo / Vercel repo drift", covered: [OPS] },
  E55: { what: "Razorpay account not activated", covered: [UNIT_CLIENT] },
  E56: { what: "missing legal pages block activation", covered: [THIS_FILE] },
};

test("the §7 ledger is complete and every covering test file exists", () => {
  const numbers = Object.keys(LEDGER);
  assert.equal(numbers.length, 56);
  // No gaps and no duplicates: E1 … E56, in order.
  assert.deepEqual(numbers, Array.from({ length: 56 }, (_, i) => `E${i + 1}`));

  for (const [id, entry] of Object.entries(LEDGER)) {
    assert.ok(entry.what.length > 8, `${id} needs a description`);
    assert.ok(entry.covered.length > 0, `${id} has no covering test`);
    for (const file of entry.covered) {
      if (file === OPS) continue;
      assert.ok(existsSync(join(root, file)), `${id} points at a missing file: ${file}`);
    }
  }

  // Exactly one case may be ops-only; anything more is coverage quietly eroding.
  const opsOnly = Object.entries(LEDGER).filter(([, e]) => e.covered.includes(OPS));
  assert.deepEqual(opsOnly.map(([id]) => id), ["E54"]);
});

test("E12: checkout and coupon endpoints are rate limited per user and per IP", () => {
  // A limiter is null when Upstash is unconfigured (dev); the contract asserted
  // here is that the four limiters are *declared*, so removing one is a visible
  // diff rather than a silent loss of the only brake on Razorpay order spam.
  for (const [name, limiter] of Object.entries({
    paymentsCheckoutLimiter,
    paymentsCheckoutIpLimiter,
    paymentsCouponLimiter,
    paymentsCouponFailureLimiter,
  })) {
    assert.ok(limiter !== undefined, `${name} must be declared`);
  }
  const checkout = readFileSync(join(root, "src/app/api/payments/checkout/route.ts"), "utf8");
  assert.match(checkout, /paymentsCheckoutLimiter/);
  assert.match(checkout, /paymentsCheckoutIpLimiter/);
  const coupon = readFileSync(join(root, "src/app/api/payments/coupon/validate/route.ts"), "utf8");
  assert.match(coupon, /paymentsCouponLimiter/);
});

test("E13: the server refuses a checkout from the Android shell, not just the UI", () => {
  const checkout = readFileSync(join(root, "src/app/api/payments/checkout/route.ts"), "utf8");
  // Play policy forbids Razorpay for digital goods. The client gate
  // (NativePurchaseNotice) is cosmetic; this is the one that cannot be bypassed.
  assert.match(checkout, /parseAppVersionFromUserAgent\(request\.headers\.get\("user-agent"\)\)/);
  assert.match(checkout, /status: 403/);
  const gateIndex = checkout.indexOf("parseAppVersionFromUserAgent");
  const workIndex = checkout.indexOf("createCheckoutOrder(");
  assert.ok(gateIndex > 0 && gateIndex < workIndex, "the native gate must run before any order work");
});

test("E18: an order carries at most one coupon code — there is no shape that stacks two", () => {
  const checkout = readFileSync(join(root, "src/app/api/payments/checkout/route.ts"), "utf8");
  // A single scalar field on the request, a single scalar column on the order.
  assert.match(checkout, /couponCode: z\.string\(\)/);
  assert.ok(!/couponCodes/.test(checkout), "no plural coupon field may exist");
  const migration = readFileSync(join(root, "src/db/migrations/20260822_payments_core.sql"), "utf8");
  assert.match(migration, /coupon_code\s+TEXT,/);
  assert.ok(!/coupon_codes/.test(migration));
  // E19's runtime clamp is exercised against the real validator in
  // tests/integration/payments-edge-cases.test.ts — validateCoupon pulls in
  // `server-only`, which cannot be imported by this (non-react-server) runner.
});

test("E22/E30: the webhook derives an id when the header is absent, and 200s once durable", () => {
  const webhook = readFileSync(join(root, "src/app/api/payments/webhook/route.ts"), "utf8");
  // E22: no header must never mean 400 — Razorpay would retry that forever.
  assert.match(webhook, /sha256:\$\{crypto\s*\n?\s*\.createHash\("sha256"\)|sha256:\$\{crypto\.createHash\("sha256"\)/);
  assert.match(webhook, /x-razorpay-event-id/);
  // E30: the durable record is written before any side effect, and the signature
  // check is the only thing that precedes it.
  const recordIndex = webhook.indexOf("recordEvent");
  const verifyIndex = webhook.search(/verifyRazorpayWebhookSignature/);
  assert.ok(verifyIndex >= 0 && recordIndex > verifyIndex, "verify, then persist");
  assert.match(webhook, /status: 400/, "a bad signature is a 400 (E23)");
});

test("E50: every payments migration is registered with the build-time runner", () => {
  const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");
  const files = readdirSync(join(root, "src/db/migrations"))
    .filter((file) => file.includes("payments") && file.endsWith(".sql") && !file.includes(".rollback."));
  assert.ok(files.length >= 5, `expected the payments migrations, found ${files.length}`);
  for (const file of files) {
    assert.ok(runner.includes(file), `${file} is not registered in run-migrations.mjs — it would never apply`);
  }
});

test("E51: payments migrations are additive — a deploy cannot land on a live checkout", () => {
  const dir = join(root, "src/db/migrations");
  const files = readdirSync(dir).filter(
    (file) => file.includes("payments") && file.endsWith(".sql") && !file.includes(".rollback."),
  );
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    // Anything here would break an in-flight order mid-deploy (plan E51/D12).
    for (const forbidden of [/\bDROP\s+TABLE\b/i, /\bDROP\s+COLUMN\b/i, /\bALTER\s+COLUMN\b/i, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i]) {
      assert.ok(!forbidden.test(sql), `${file} contains ${forbidden} — not additive`);
    }
    // Constraint and index drops ARE allowed (widening a CHECK, replacing an
    // index) but only when the same file puts something back.
    const drops = (sql.match(/\bDROP\s+(CONSTRAINT|INDEX)\b/gi) ?? []).length;
    if (drops > 0) {
      assert.match(sql, /\b(ADD\s+CONSTRAINT|CREATE\s+(UNIQUE\s+)?INDEX)\b/i, `${file} drops without recreating`);
    }
  }
});

test("E52: the whole surface is revertible by a flag, and every migration has a rollback", () => {
  // The flag is the rollback path (plan D13/E52); the .sql is the last resort.
  assert.ok(ALL_FLAG_KEYS.includes("payments"));
  const previous = process.env.TEACHER_LAUNCH_PAYMENTS;
  try {
    delete process.env.TEACHER_LAUNCH_PAYMENTS;
    assert.equal(isFeatureEnabled("payments"), false, "ships dark — off unless explicitly enabled");
    process.env.TEACHER_LAUNCH_PAYMENTS = "1";
    assert.equal(isFeatureEnabled("payments"), true);
    process.env.TEACHER_LAUNCH_PAYMENTS = "0";
    assert.equal(isFeatureEnabled("payments"), false, "one env var reverts the whole surface");
  } finally {
    if (previous === undefined) delete process.env.TEACHER_LAUNCH_PAYMENTS;
    else process.env.TEACHER_LAUNCH_PAYMENTS = previous;
  }
  const dir = join(root, "src/db/migrations");
  const files = readdirSync(dir).filter(
    (file) => file.includes("payments") && file.endsWith(".sql") && !file.includes(".rollback."),
  );
  for (const file of files) {
    const rollback = file.replace(/\.sql$/, ".rollback.sql");
    assert.ok(existsSync(join(dir, rollback)), `${file} has no ${rollback}`);
  }
});

test("E56: the legal pages Razorpay requires are live, public, and carry a contact address", () => {
  const required = [
    "/terms-and-conditions",
    "/privacy-policy",
    "/refund-policy",
    "/shipping-policy",
    "/childrens-policy",
  ];
  for (const path of required) {
    const page = join(root, "src/app", path.replace(/^\//, ""), "page.tsx");
    assert.ok(existsSync(page), `${path} page is missing`);
    // A logged-out Razorpay reviewer must be able to read it.
    assert.equal(getAppRoutePolicy(path).kind, "public", path);
    // Razorpay's checklist wants reachable contact details on the policy pages;
    // Origin has no standalone /contact route, so the address lives on each.
    assert.match(readFileSync(page, "utf8"), /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/, `${path} has no contact address`);
  }
  // The pricing snapshot a reviewer sees before signing in.
  assert.equal(getApiRoutePolicy("/api/pricing").kind, "public");
});

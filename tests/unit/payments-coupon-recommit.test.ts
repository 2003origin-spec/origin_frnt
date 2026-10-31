/**
 * Bug-fix P2 — coupon hold released, payment still succeeds.
 *
 * Razorpay orders never expire gateway-side, so a capture can land after the
 * local coupon hold lapsed. This pins the control flow that closes the leak,
 * against a fake pg pool (same seam as tests/cbt-quota-enforcement.test.ts):
 *   1. `commitOrRecommitCoupon` state machine over a recording executor:
 *        reserved → committed; released → committed[overrun=false] when the
 *        caps still have room; released → committed[overrun=true] when the cap
 *        (global or per-user) is exhausted — honoured, counted, flagged.
 *   2. `applyPaymentSuccess` on an order whose hold was released: the order is
 *      paid, the hold is re-committed, and an overrun writes the note, fans
 *      out an admin alert and emits the metric.
 *   3. `payment.failed` keeps the order open and never releases the hold.
 *   4. The stale-hold sweep only frees order-backed holds once the order is
 *      terminal.
 */

import test from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";

// ── A fake pg pool ──────────────────────────────────────────────────────────

type Rows = { rows: Record<string, unknown>[]; rowCount?: number };
type Handler = (sql: string, params: unknown[]) => Rows | undefined;

const db = {
  queries: [] as { sql: string; params: unknown[] }[],
  handler: (() => undefined) as Handler,
};

function fakeQuery(sql: string, params: unknown[] = []) {
  db.queries.push({ sql, params });
  const out = db.handler(sql, params) ?? { rows: [] };
  return Promise.resolve({ rowCount: out.rowCount ?? out.rows.length, ...out });
}

const fakePool = {
  query: fakeQuery,
  connect: () => Promise.resolve({ query: fakeQuery, release: () => undefined }),
};

function ran(fragment: string | RegExp): { sql: string; params: unknown[] }[] {
  return db.queries.filter((q) => (typeof fragment === "string" ? q.sql.includes(fragment) : fragment.test(q.sql)));
}

// ── Module interception ─────────────────────────────────────────────────────

const metrics: { name: string; tags: Record<string, unknown> }[] = [];

const ORIGINAL_LOAD = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  const request = args[0] as string;
  if (request === "server-only") return {};
  if (request === "@/server/user-postgres" || request.endsWith("/user-postgres")) {
    return {
      getUserPostgresPool: () => fakePool,
      getUserPostgresReplicaPool: () => fakePool,
      isUserPostgresConfigured: () => true,
    };
  }
  if (request === "@/lib/metrics") {
    return { metric: (name: string, tags: Record<string, unknown> = {}) => metrics.push({ name, tags }) };
  }
  if (request === "@/server/entitlements") {
    return { recomputeUserPremiumFlags: async () => undefined };
  }
  if (request === "@/server/pricing/pricing-service") {
    return { getActiveBundle: async () => null, getSubjectPriceResolved: async () => ({ amountMinor: 49900 }) };
  }
  if (request === "./grants") {
    return {
      grantPaidTerm: async (input: { userId: string; subject: string; orderId: string }) => ({
        id: `sg_${input.subject}`,
        userId: input.userId,
        subject: input.subject,
        source: "paid_order",
        orderId: input.orderId,
        expiresAt: "2027-01-01T00:00:00.000Z",
        status: "active",
        createdAt: "2026-10-21T00:00:00.000Z",
        updatedAt: "2026-10-21T00:00:00.000Z",
      }),
      rebasePaidGrantExpiriesForSubject: async () => 0,
      paidTermExpiry: () => new Date("2027-01-01T00:00:00.000Z"),
    };
  }
  if (request === "./institute-orders") {
    return {
      resolveInstituteOffering: async () => { throw new Error("not used"); },
      openInstituteEnrollmentOrder: async () => { throw new Error("not used"); },
      applyInstituteEnrollment: async () => undefined,
    };
  }
  return ORIGINAL_LOAD.apply(this, args);
};

// Schema ensures are DDL we never want here.
globalThis.__originPaymentsSchemaEnsured = true;
globalThis.__originPricingSchemaEnsured = true;
globalThis.__originSubjectGrantsSchemaEnsured = true;
globalThis.__originUserSchemaEnsured = true;
globalThis.__originNowSchemaEnsured = true;

/* eslint-disable @typescript-eslint/no-require-imports */
const coupons = require("@/server/pricing/coupons-service") as typeof import("@/server/pricing/coupons-service");
const orders = require("@/server/payments/orders-service") as typeof import("@/server/payments/orders-service");
const policy = require("@/server/payments/reconciliation-policy") as typeof import("@/server/payments/reconciliation-policy");
/* eslint-enable @typescript-eslint/no-require-imports */

const { commitOrRecommitCoupon } = coupons;
/** The fake executor, typed as the pg seam the service expects. */
const EXEC = { query: fakeQuery } as unknown as import("@/server/pricing/coupons-service").CouponExecutor;
const { applyPaymentSuccess, processPaymentEvent } = orders;

// ── 1. commitOrRecommitCoupon state machine ─────────────────────────────────

type CouponScenario = {
  /** The hold row for this order is still `reserved`. */
  reserved: boolean;
  /** A `released` row for this order exists (recycled in place). */
  released: boolean;
  /** Global cap still has room (guarded bump returns a row). */
  globalRoom: boolean;
  /** Committed redemptions by this user on OTHER orders, and the limit. */
  perUser?: { n: number; limit: number };
};

function couponHandler(s: CouponScenario): Handler {
  return (sql) => {
    if (sql.includes("FROM pricing.coupons WHERE code = $1 FOR UPDATE")) return { rows: [{ code: "SAVE10" }] };
    if (sql.includes("SET state = 'committed', expires_at = NULL") && sql.includes("state = 'reserved'")) {
      return s.reserved ? { rows: [{ id: "cpnr_1" }] } : { rows: [], rowCount: 0 };
    }
    if (sql.includes("state = 'committed'") && sql.includes("LIMIT 1") && sql.startsWith("SELECT id")) return { rows: [] };
    if (sql.includes("COUNT(*) FILTER")) return { rows: [{ n: s.perUser?.n ?? 0, limit: s.perUser?.limit ?? 1 }] };
    if (sql.includes("times_redeemed < max_redemptions") && sql.includes("RETURNING code")) {
      return s.globalRoom ? { rows: [{ code: "SAVE10" }] } : { rows: [], rowCount: 0 };
    }
    if (sql.includes("overrun = $4") && sql.includes("state = 'released'")) {
      return s.released ? { rows: [{ id: "cpnr_1" }] } : { rows: [], rowCount: 0 };
    }
    return undefined;
  };
}

const INPUT = { code: "save10", userId: "user_1", orderId: "ord_1", subject: "physics", amountDiscountedMinor: 4990 };

test("reserved → committed: the normal commit, no counter change", async () => {
  db.queries = [];
  db.handler = couponHandler({ reserved: true, released: false, globalRoom: true });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "committed");
  // Lock order: coupon row first.
  assert.match(db.queries[0].sql, /FROM pricing\.coupons WHERE code = \$1 FOR UPDATE/);
  assert.equal(db.queries[0].params[0], "SAVE10");
  assert.equal(ran("times_redeemed + 1").length, 0);
  assert.equal(ran("INSERT INTO pricing.coupon_redemptions").length, 0);
});

test("released → committed[overrun=false] when the caps still have room", async () => {
  db.queries = [];
  db.handler = couponHandler({ reserved: false, released: true, globalRoom: true });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "recommitted");
  // Exactly one guarded bump, no unconditional oversell bump.
  const bumps = ran("times_redeemed + 1");
  assert.equal(bumps.length, 1);
  assert.match(bumps[0].sql, /times_redeemed < max_redemptions/);
  // The released row is recycled in place with overrun = false …
  const recycled = ran("overrun = $4");
  assert.equal(recycled.length, 1);
  assert.equal(recycled[0].params[3], false);
  assert.equal(recycled[0].params[4], 4990);
  // … and no second row is inserted beside it.
  assert.equal(ran("INSERT INTO pricing.coupon_redemptions").length, 0);
});

test("released → committed[overrun=true] when max_redemptions is exhausted: honoured, counted, flagged", async () => {
  db.queries = [];
  db.handler = couponHandler({ reserved: false, released: true, globalRoom: false });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "overrun");
  const bumps = ran("times_redeemed + 1");
  assert.equal(bumps.length, 2, "guarded bump (0 rows) then the honest oversell bump");
  assert.doesNotMatch(bumps[1].sql, /max_redemptions/);
  const recycled = ran("overrun = $4");
  assert.equal(recycled.length, 1);
  assert.equal(recycled[0].params[3], true);
});

test("released → overrun when the per-user limit is already used on another order", async () => {
  db.queries = [];
  db.handler = couponHandler({ reserved: false, released: true, globalRoom: true, perUser: { n: 1, limit: 1 } });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "overrun");
  // Global cap had room, so only the guarded bump ran — the slot IS consumed.
  assert.equal(ran("times_redeemed + 1").length, 1);
  assert.equal(ran("overrun = $4")[0].params[3], true);
});

test("no row at all → a fresh committed row is inserted under the partial unique index", async () => {
  db.queries = [];
  db.handler = couponHandler({ reserved: false, released: false, globalRoom: true });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "recommitted");
  const inserts = ran("INSERT INTO pricing.coupon_redemptions");
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /ON CONFLICT \(code, order_id\) WHERE order_id IS NOT NULL AND state IN \('reserved','committed'\) DO NOTHING/);
  assert.equal(inserts[0].params[5], "ord_1");
  assert.equal(inserts[0].params[6], false);
});

test("a second late commit for the same order is a no-op on the counters", async () => {
  db.queries = [];
  const base = couponHandler({ reserved: false, released: false, globalRoom: true });
  db.handler = (sql, params) => {
    if (sql.startsWith("SELECT id") && sql.includes("state = 'committed'")) return { rows: [{ id: "cpnr_1" }] };
    return base(sql, params);
  };
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "committed");
  assert.equal(ran("times_redeemed + 1").length, 0);
});

test("a deleted coupon never fails the capture: flagged as overrun, nothing written", async () => {
  db.queries = [];
  db.handler = () => ({ rows: [], rowCount: 0 });
  assert.equal(await commitOrRecommitCoupon(INPUT, EXEC), "overrun");
  assert.equal(db.queries.length, 1, "only the coupon lock ran");
  assert.equal(ran("INSERT INTO pricing.coupon_redemptions").length, 0);
  assert.equal(ran("times_redeemed").length, 0);
});

// ── 2. applyPaymentSuccess on a lapsed hold ─────────────────────────────────

function orderRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "ord_1",
    user_id: "user_1",
    kind: "subject_term",
    subject: "physics",
    bundle_id: null,
    workspace_id: null,
    offering_id: null,
    term_months: 1,
    base_amount_minor: 49900,
    discount_minor: 4990,
    amount_minor: 44910,
    currency: "INR",
    coupon_code: "SAVE10",
    razorpay_order_id: "order_rzp_1",
    status: "expired",
    livemode: false,
    idempotency_key: null,
    failure_reason: "checkout_expired",
    notes: { bundle_subjects: [] },
    created_at: "2026-10-21T10:00:00.000Z",
    updated_at: "2026-10-21T10:31:00.000Z",
    paid_at: null,
    expires_at: "2026-10-21T10:30:00.000Z",
    ...overrides,
  };
}

/** The ledger side of a late capture; the coupon side comes from couponHandler. */
function captureHandler(order: Record<string, unknown>, coupon: Handler, outbox: Record<string, unknown>[]): Handler {
  return (sql, params) => {
    if (sql.includes("FROM payments.orders") && sql.includes("WHERE id = $1") && sql.startsWith("SELECT")) {
      return { rows: [order] };
    }
    if (sql.includes("FROM payments.payments WHERE razorpay_payment_id = $1")) return { rows: [] };
    if (sql.startsWith("INSERT INTO payments.payments")) {
      return {
        rows: [{
          razorpay_payment_id: params[0], order_id: params[1], user_id: params[4], amount_minor: params[5],
          amount_refunded_minor: 0, currency: "INR", method: params[7], status: "captured",
          livemode: false, captured_at: params[12], raw: {}, created_at: "2026-10-21T12:00:00.000Z",
        }],
      };
    }
    if (sql.includes("SET status         = $2::payments.order_status")) {
      order.status = params[1];
      order.paid_at = params[4];
      return { rows: [order] };
    }
    if (sql.includes(`'{"coupon_overrun":true}'::jsonb`)) {
      order.notes = { ...(order.notes as Record<string, unknown>), coupon_overrun: true };
      return { rows: [] };
    }
    if (sql.includes("FROM origin_users WHERE role = 'admin'")) return { rows: [{ id: "admin_1" }, { id: "admin_2" }] };
    if (sql.includes("SELECT email, name FROM origin_users")) return { rows: [{ email: "s@example.test", name: "S" }] };
    if (sql.startsWith("INSERT INTO payments.outbox")) {
      outbox.push({ id: params[0], kind: params[1], payload: JSON.parse(String(params[2])) });
      return { rows: [] };
    }
    return coupon(sql, params);
  };
}

test("late capture after the hold was released: order paid, hold re-committed, no alert", async () => {
  db.queries = [];
  metrics.length = 0;
  const order = orderRow();
  const outbox: Record<string, unknown>[] = [];
  db.handler = captureHandler(order, couponHandler({ reserved: false, released: true, globalRoom: true }), outbox);

  const result = await applyPaymentSuccess({
    orderId: "ord_1",
    razorpayOrderId: "order_rzp_1",
    razorpayPaymentId: "pay_late_1",
    amountMinor: 44910,
    currency: "INR",
    now: new Date("2026-10-21T12:00:00.000Z"),
  });

  assert.equal(result.alreadyApplied, false);
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.notes.coupon_overrun, undefined);
  // Hold re-committed under the coupon lock, inside the capture transaction.
  const recycled = ran("overrun = $4");
  assert.equal(recycled.length, 1);
  assert.deepEqual(recycled[0].params.slice(0, 4), ["SAVE10", "user_1", "ord_1", false]);
  assert.equal(recycled[0].params[4], 4990, "amountDiscountedMinor comes from order.discountMinor");
  const begin = db.queries.findIndex((q) => q.sql === "BEGIN");
  const commit = db.queries.findIndex((q) => q.sql === "COMMIT");
  const commitIdx = db.queries.indexOf(recycled[0]);
  assert.ok(begin < commitIdx && commitIdx < commit, "re-commit happens inside the money transaction");
  // Nothing was released, the slot was consumed once.
  assert.equal(ran("state = 'released'").filter((q) => q.sql.includes("SET state = 'released'")).length, 0);
  assert.equal(ran("times_redeemed + 1").length, 1);
  // Receipt only; no admin alert, no metric.
  assert.deepEqual(outbox.map((row) => row.kind), ["receipt_email"]);
  assert.equal(metrics.length, 0);
});

test("late capture past the cap: still paid, overrun flagged on the row and the order, admins alerted", async () => {
  db.queries = [];
  metrics.length = 0;
  const order = orderRow();
  const outbox: Record<string, unknown>[] = [];
  db.handler = captureHandler(order, couponHandler({ reserved: false, released: true, globalRoom: false }), outbox);

  const result = await applyPaymentSuccess({
    orderId: "ord_1",
    razorpayPaymentId: "pay_late_2",
    amountMinor: 44910,
    now: new Date("2026-10-21T12:00:00.000Z"),
  });

  // Money that landed is never altered: the order is paid at its amount.
  assert.equal(result.order.status, "paid");
  assert.equal(result.order.amountMinor, 44910);
  assert.equal(result.order.notes.coupon_overrun, true);
  assert.equal(ran("overrun = $4")[0].params[3], true);
  assert.equal(ran("times_redeemed + 1").length, 2, "oversell is counted honestly");
  // One warning notification per admin, idempotent on the payment id, plus the receipt.
  const alerts = outbox.filter((row) => row.kind === "notification");
  assert.deepEqual(alerts.map((row) => row.id), ["coupon_overrun_pay_late_2_admin_1", "coupon_overrun_pay_late_2_admin_2"]);
  const payload = alerts[0].payload as Record<string, unknown>;
  assert.equal(payload.notificationTitle, "Coupon cap exceeded");
  assert.match(String(payload.notificationMessage), /SAVE10 was honoured on ord_1/);
  assert.equal(payload.href, "/admin/financials");
  assert.equal(outbox.filter((row) => row.kind === "receipt_email").length, 1);
  assert.deepEqual(metrics, [{ name: "origin.payments.coupon.overrun", tags: { code: "SAVE10" } }]);
  // Alerts were enqueued before COMMIT.
  const commit = db.queries.findIndex((q) => q.sql === "COMMIT");
  const alertInsert = db.queries.findIndex((q) => q.sql.startsWith("INSERT INTO payments.outbox") && String(q.params[0]).startsWith("coupon_overrun_"));
  assert.ok(alertInsert > -1 && alertInsert < commit);
});

test("normal capture with a live hold commits it and never touches the counters", async () => {
  db.queries = [];
  metrics.length = 0;
  const order = orderRow({ status: "attempted", failure_reason: null });
  const outbox: Record<string, unknown>[] = [];
  db.handler = captureHandler(order, couponHandler({ reserved: true, released: false, globalRoom: true }), outbox);
  const result = await applyPaymentSuccess({ orderId: "ord_1", razorpayPaymentId: "pay_ok", amountMinor: 44910 });
  assert.equal(result.order.status, "paid");
  assert.equal(ran("times_redeemed").length, 0);
  assert.equal(outbox.filter((row) => row.kind === "notification").length, 0);
});

// ── 3. payment.failed keeps the order open and the hold reserved ────────────

test("payment.failed records an attempt: order stays open, coupon hold untouched, student emailed", async () => {
  db.queries = [];
  const order = orderRow({ status: "attempted", failure_reason: null });
  const outbox: Record<string, unknown>[] = [];
  db.handler = (sql, params) => {
    if (sql.includes("FROM payments.orders WHERE razorpay_order_id = $1")) return { rows: [order] };
    if (sql.includes("FROM payments.orders") && sql.includes("WHERE id = $1")) return { rows: [order] };
    if (sql.includes("SET status         = $2::payments.order_status")) {
      order.status = params[1];
      order.failure_reason = params[2];
      return { rows: [order] };
    }
    if (sql.includes("SELECT email, name FROM origin_users")) return { rows: [{ email: "s@example.test", name: "S" }] };
    if (sql.startsWith("INSERT INTO payments.outbox")) {
      outbox.push({ id: params[0], kind: params[1], payload: JSON.parse(String(params[2])) });
      return { rows: [] };
    }
    return undefined;
  };

  const result = await processPaymentEvent({
    event: "payment.failed",
    payload: { payment: { entity: { id: "pay_fail_1", order_id: "order_rzp_1", error_description: "OTP incorrect" } } },
  });

  assert.ok(result && typeof result === "object" && "status" in result);
  assert.equal((result as { status: string }).status, "attempted", "never 'failed' while the Razorpay order is payable");
  assert.equal((result as { failureReason: string | null }).failureReason, "OTP incorrect");
  // No coupon query at all: the hold is still reserved for the retry.
  assert.equal(db.queries.filter((q) => q.sql.includes("pricing.coupon")).length, 0);
  assert.equal(ran("times_redeemed").length, 0);
  assert.equal(ran("idempotency_key = CASE WHEN $4").filter((q) => q.params[3] === true).length, 0, "the idempotency key survives a retry");
  assert.deepEqual(outbox.map((row) => [row.id, row.kind]), [["payment_failed_ord_1", "payment_failed_email"]]);
  assert.equal((outbox[0].payload as Record<string, unknown>).failureReason, "OTP incorrect");
});

test("payment.failed for an already-paid order is ignored, and for an unknown order stays retryable", async () => {
  db.queries = [];
  const order = orderRow({ status: "paid", paid_at: "2026-10-21T11:00:00.000Z" });
  db.handler = (sql) => {
    if (sql.includes("FROM payments.orders WHERE razorpay_order_id = $1")) return { rows: [order] };
    if (sql.includes("FROM payments.orders") && sql.includes("WHERE id = $1")) return { rows: [order] };
    return undefined;
  };
  const result = await processPaymentEvent({
    event: "payment.failed",
    payload: { payment: { entity: { id: "pay_fail_2", order_id: "order_rzp_1" } } },
  });
  assert.equal((result as { status: string }).status, "paid");
  assert.equal(ran("SET status").length, 0);
  assert.equal(ran("INSERT INTO payments.outbox").length, 0);

  db.handler = () => ({ rows: [] });
  await assert.rejects(
    processPaymentEvent({ event: "payment.failed", payload: { payment: { entity: { id: "pay_x", order_id: "order_missing" } } } }),
    /unknown order/,
  );
});

// ── 4. The sweep only releases terminal orders ──────────────────────────────

test("stale-hold sweep: order-backed holds are released only when the order is failed/expired", () => {
  const where = policy.STALE_COUPON_HOLD_WHERE_SQL;
  assert.match(where, /r\.state = 'reserved'/);
  // The hold's own TTL applies only to holds with no order behind them.
  assert.match(where, /\(r\.order_id IS NULL AND r\.expires_at <= \$1\)/);
  assert.doesNotMatch(where, /\n\s*r\.expires_at <= \$1\s*\n/, "no bare expires_at clause for order-backed holds");
  // Order-backed: terminal order, or the order row has vanished.
  assert.match(where, /o\.status IN \('failed', 'expired'\)/);
  assert.match(where, /o\.id IS NULL AND r\.order_id IS NOT NULL AND r\.redeemed_at <= \$1 - INTERVAL '30 minutes'/);
  // An open order never qualifies: created/attempted appear nowhere in the predicate.
  assert.doesNotMatch(where, /'created'|'attempted'/);

  const reconciliation = readFileSync(new URL("../../src/server/payments/reconciliation.ts", import.meta.url), "utf8");
  assert.match(reconciliation, /LEFT JOIN payments\.orders o ON o\.id = r\.order_id\s+WHERE \$\{STALE_COUPON_HOLD_WHERE_SQL\}/);
});

test("source contract: markOrderFailed is only reachable from checkout creation", () => {
  const source = readFileSync(new URL("../../src/server/payments/orders-service.ts", import.meta.url), "utf8");
  // The webhook routing lives in event-router.ts (P4); orders-service binds the handlers.
  const router = readFileSync(new URL("../../src/server/payments/event-router.ts", import.meta.url), "utf8");
  const failedBranch = router.slice(router.indexOf('event === "payment.failed"'), router.indexOf('event === "order.paid"'));
  assert.match(failedBranch, /handlers\.markPaymentAttemptFailed\(/);
  assert.doesNotMatch(failedBranch, /markOrderFailed/);
  const processBody = source.slice(source.indexOf("export async function processPaymentEvent"));
  assert.match(processBody, /routePaymentEvent\(input, \{[^}]*\bmarkPaymentAttemptFailed,/);
  assert.doesNotMatch(processBody, /markOrderFailed/);
  const createBody = source.slice(source.indexOf("export async function createCheckoutOrder"), source.indexOf("function safeKeyId"));
  assert.equal((createBody.match(/await markOrderFailed\(/g) ?? []).length, 3, "coupon reserve, zero-amount settle, Razorpay create");
  assert.equal((source.match(/await markOrderFailed\(/g) ?? []).length, 3);
  assert.match(source, /commitOrRecommitCoupon\(/);
  assert.doesNotMatch(source, /commitCouponReservation\(/);
});

/**
 * Phase 8 database acceptance: the admin financial summary and the ledger
 * browser, read back from a real Postgres.
 *
 * The whole suite works inside a **historical** IST window (May 2019) in
 * **live** mode. Nothing else in the codebase writes live-mode money at that
 * date, so every assertion here is an absolute figure rather than a delta, and
 * a stray row left behind by another suite cannot make it pass or fail by
 * accident. Skips unless a disposable USER_DATABASE_URL is configured.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { resolveRange, getPaymentsSummary } from "@/server/payments/financials";
import { ledgerToCsv, listLedger, type LedgerFilters } from "@/server/payments/ledger-query";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import {
  attachRazorpayOrderId,
  insertOrder,
  insertRefund,
  newOrderId,
  setOrderStatus,
  upsertPayment,
  type OrderKind,
  type OrderStatus,
} from "@/server/payments/payments-store";

import { cleanup, closePool, dbConfigured, makeId, rawPool, seedFixtures, type Fixtures } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };

/** 00:00 IST on 2019-05-11 is 18:30 UTC on 2019-05-10. */
const DAY_1 = "2019-05-10";
const DAY_2 = "2019-05-11";
const DAY_3 = "2019-05-12";
/** The last millisecond of DAY_1 in IST. */
const LATE_ON_DAY_1 = "2019-05-10T18:29:59.999Z";
/** The first millisecond of DAY_2 in IST — 1 ms later, a different IST day. */
const EARLY_ON_DAY_2 = "2019-05-10T18:30:00.000Z";
const MIDDAY_DAY_2 = "2019-05-11T06:00:00.000Z";
const MIDDAY_DAY_3 = "2019-05-12T06:00:00.000Z";

let fixtures: Fixtures;
let studentId = "";
let otherStudentId = "";
const orderIds: string[] = [];
const paymentIds: string[] = [];
const refundIds: string[] = [];
let couponCode = "";

type SeedOrder = {
  kind?: OrderKind;
  subject?: string | null;
  termMonths?: number;
  baseAmountMinor?: number;
  discountMinor?: number;
  amountMinor: number;
  couponCode?: string | null;
  livemode?: boolean;
  userId?: string;
  createdAt: string;
  /** Omit to leave the order unpaid. */
  capturedAt?: string | null;
  method?: string;
  status?: OrderStatus;
  notes?: Record<string, unknown>;
};

async function seedOrder(input: SeedOrder) {
  const userId = input.userId ?? studentId;
  const livemode = input.livemode ?? true;
  const order = await insertOrder({
    id: newOrderId(),
    userId,
    kind: input.kind ?? "subject_term",
    subject: input.subject === undefined ? "physics" : input.subject,
    termMonths: input.termMonths ?? 1,
    baseAmountMinor: input.baseAmountMinor ?? input.amountMinor,
    discountMinor: input.discountMinor ?? 0,
    amountMinor: input.amountMinor,
    couponCode: input.couponCode ?? null,
    livemode,
    notes: input.notes,
  });
  orderIds.push(order.id);
  await attachRazorpayOrderId(order.id, `order_ph8_${order.id}`);
  // insertOrder stamps NOW(); the funnel counts orders by the day they were
  // opened, so the historical window needs the real created_at.
  await rawPool().query(`UPDATE payments.orders SET created_at = $2 WHERE id = $1`, [
    order.id,
    input.createdAt,
  ]);

  let paymentId: string | null = null;
  if (input.capturedAt) {
    paymentId = `pay_ph8_${order.id}`;
    paymentIds.push(paymentId);
    await upsertPayment({
      razorpayPaymentId: paymentId,
      orderId: order.id,
      userId,
      amountMinor: input.amountMinor,
      currency: "INR",
      method: input.method ?? "upi",
      status: "captured",
      livemode,
      capturedAt: new Date(input.capturedAt),
    });
    await setOrderStatus(order.id, "paid", { paidAt: new Date(input.capturedAt) });
  }
  if (input.status && input.status !== "paid") {
    await rawPool().query(
      `UPDATE payments.orders SET status = $2::payments.order_status WHERE id = $1`,
      [order.id, input.status],
    );
  }
  return { orderId: order.id, paymentId };
}

async function seedRefund(input: {
  paymentId: string;
  amountMinor: number;
  isFull: boolean;
  createdAt: string;
  livemode?: boolean;
}) {
  const refundId = makeId("rfnd_ph8");
  refundIds.push(refundId);
  await insertRefund({
    razorpayRefundId: refundId,
    razorpayPaymentId: input.paymentId,
    amountMinor: input.amountMinor,
    isFull: input.isFull,
    status: "processed",
    livemode: input.livemode ?? true,
  });
  await rawPool().query(`UPDATE payments.refunds SET created_at = $2 WHERE razorpay_refund_id = $1`, [
    refundId,
    input.createdAt,
  ]);
  return refundId;
}

function liveRange(from: string, to: string) {
  return resolveRange({ from, to });
}

test("setup: Phase 8 schemas and a historical live-mode window", opts, async () => {
  fixtures = await seedFixtures();
  studentId = fixtures.studentId;
  otherStudentId = fixtures.ownerId;
  await ensurePaymentsAndGrantSchema();
  // `mrr.subscriptionsAvailable` reports whether the Rail-B tables EXIST, so it
  // is only deterministic if this file creates them itself. Without this the
  // assertion passed or failed depending on whether another test file had
  // already run ensureSubscriptionsSchema against the shared database.
  await ensureSubscriptionsSchema();

  couponCode = `PH8_${Date.now().toString(36).toUpperCase()}`;
  await rawPool().query(
    `INSERT INTO pricing.coupons (code, kind, value, applies_to, per_user_limit, active)
     VALUES ($1, 'percent', 10, 'any', 10, TRUE)
     ON CONFLICT (code) DO NOTHING`,
    [couponCode],
  );

  // Nothing live-mode should exist in this window before the suite writes.
  const pre = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(pre.totals.grossMinor, 0, "the historical live window must start empty");
  assert.equal(pre.funnel.ordersCreated, 0);
});

test("revenue lands on the IST day it was captured, not the UTC one", opts, async () => {
  await seedOrder({ amountMinor: 49_900, createdAt: LATE_ON_DAY_1, capturedAt: LATE_ON_DAY_1 });
  await seedOrder({ amountMinor: 10_000, createdAt: LATE_ON_DAY_1, capturedAt: EARLY_ON_DAY_2 });

  const dayOne = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_1) });
  assert.equal(dayOne.totals.grossMinor, 49_900, "23:59:59.999 IST is still day one");
  assert.equal(dayOne.totals.payments, 1);
  assert.deepEqual(dayOne.byDay.map((point) => point.date), [DAY_1]);
  assert.equal(dayOne.byDay[0].grossMinor, 49_900);

  const dayTwo = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_2, DAY_2) });
  assert.equal(dayTwo.totals.grossMinor, 10_000, "one millisecond later is the next IST day");

  // Both charges are inside the same UTC day; only the IST split separates them.
  assert.equal(LATE_ON_DAY_1.slice(0, 10), EARLY_ON_DAY_2.slice(0, 10));

  const both = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_2) });
  assert.equal(both.totals.grossMinor, 59_900);
  assert.equal(both.totals.payingUsers, 1, "one student, two charges");
  assert.equal(both.totals.averageOrderValueMinor, 29_950);
});

test("test-mode money is quarantined out of live revenue", opts, async () => {
  await seedOrder({ amountMinor: 999_999, createdAt: MIDDAY_DAY_2, capturedAt: MIDDAY_DAY_2, livemode: false });

  const live = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(live.totals.grossMinor, 59_900, "the test charge must not appear in live revenue");

  const test = await getPaymentsSummary({ livemode: false, range: liveRange(DAY_1, DAY_3) });
  assert.equal(test.totals.grossMinor, 999_999);
  assert.equal(test.livemode, false);
});

test("a paid order with no captured charge is never counted as revenue", opts, async () => {
  const { orderId } = await seedOrder({ amountMinor: 250_000, createdAt: MIDDAY_DAY_2 });
  await rawPool().query(
    `UPDATE payments.orders SET status = 'paid', paid_at = $2 WHERE id = $1`,
    [orderId, MIDDAY_DAY_2],
  );

  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(summary.totals.grossMinor, 59_900, "an order without a charge is a discrepancy, not income");
  assert.equal(summary.funnel.ordersPaid, 3, "the funnel still sees it as paid, which is how it shows up");
});

test("subject, method and kind attribution keeps a bundle whole", opts, async () => {
  await seedOrder({
    kind: "bundle_term",
    subject: null,
    amountMinor: 149_900,
    termMonths: 3,
    createdAt: MIDDAY_DAY_2,
    capturedAt: MIDDAY_DAY_2,
    method: "card",
    notes: { bundle_subjects: ["physics", "chemistry", "mathematics", "biology"] },
  });
  await seedOrder({
    subject: "biology",
    amountMinor: 39_900,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
    method: "netbanking",
  });

  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  const bySubject = Object.fromEntries(summary.bySubject.map((slice) => [slice.key, slice.grossMinor]));
  assert.equal(bySubject.physics, 59_900);
  assert.equal(bySubject.biology, 39_900);
  assert.equal(bySubject.bundle, 149_900, "the bundle is one bucket, not four invented subject prices");
  assert.equal(bySubject.mathematics, undefined);

  const byMethod = Object.fromEntries(summary.byMethod.map((slice) => [slice.key, slice.grossMinor]));
  assert.deepEqual(byMethod, { upi: 59_900, card: 149_900, netbanking: 39_900 });

  const byKind = Object.fromEntries(summary.byKind.map((slice) => [slice.key, slice.grossMinor]));
  assert.equal(byKind.subject_term, 99_800);
  assert.equal(byKind.bundle_term, 149_900);

  // The slices must reconcile against the headline gross, or a chart is lying.
  const total = summary.bySubject.reduce((sum, slice) => sum + slice.grossMinor, 0);
  assert.equal(total, summary.totals.grossMinor);
  assert.equal(summary.byMethod.reduce((sum, s) => sum + s.grossMinor, 0), summary.totals.grossMinor);
  assert.equal(summary.byKind.reduce((sum, s) => sum + s.grossMinor, 0), summary.totals.grossMinor);
});

test("refunds are attributed to the day they happened and drive the refund rate", opts, async () => {
  const { paymentId } = await seedOrder({
    amountMinor: 100_000,
    createdAt: MIDDAY_DAY_2,
    capturedAt: MIDDAY_DAY_2,
  });
  assert.ok(paymentId);
  await seedRefund({ paymentId, amountMinor: 25_000, isFull: false, createdAt: MIDDAY_DAY_3 });

  const dayTwo = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_2, DAY_2) });
  assert.equal(dayTwo.totals.refundedMinor, 0, "the charge's own day is not retroactively reduced");

  const dayThree = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_3, DAY_3) });
  assert.equal(dayThree.totals.refundedMinor, 25_000);
  assert.equal(dayThree.totals.refunds, 1);
  assert.equal(dayThree.totals.grossMinor, 39_900);
  assert.equal(dayThree.totals.netMinor, 14_900);
  assert.equal(dayThree.byDay[0].netMinor, 14_900);

  const whole = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(whole.totals.grossMinor, 349_700);
  assert.equal(whole.totals.refundedMinor, 25_000);
  assert.equal(whole.totals.netMinor, 324_700);
  assert.equal(whole.totals.refundRate, 0.0715);
});

test("a dispute is reported without touching revenue", opts, async () => {
  const { paymentId } = await seedOrder({
    amountMinor: 20_000,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
  });
  await rawPool().query(
    `UPDATE payments.payments SET disputed_at = $2, dispute_status = 'open' WHERE razorpay_payment_id = $1`,
    [paymentId, MIDDAY_DAY_3],
  );

  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(summary.totals.disputes, 1);
  assert.equal(summary.totals.grossMinor, 369_700, "a disputed charge is still captured revenue");
});

test("coupon attribution reports the discount given and the revenue it brought", opts, async () => {
  await seedOrder({
    subject: "chemistry",
    baseAmountMinor: 50_000,
    discountMinor: 5_000,
    amountMinor: 45_000,
    couponCode,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
  });
  await seedOrder({
    subject: "chemistry",
    baseAmountMinor: 50_000,
    discountMinor: 5_000,
    amountMinor: 45_000,
    couponCode,
    userId: otherStudentId,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
  });
  // An unpaid coupon order must not be attributed — the coupon brought nothing.
  await seedOrder({
    subject: "chemistry",
    baseAmountMinor: 50_000,
    discountMinor: 5_000,
    amountMinor: 45_000,
    couponCode,
    createdAt: MIDDAY_DAY_3,
    status: "expired",
  });

  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  const coupon = summary.coupons.find((row) => row.code === couponCode);
  assert.ok(coupon, "the coupon must appear in the attribution list");
  assert.equal(coupon.orders, 2, "only the two captured orders count");
  assert.equal(coupon.discountMinor, 10_000);
  assert.equal(coupon.grossMinor, 90_000);
  assert.equal(summary.totals.payingUsers, 2, "the second buyer is a distinct paying user");
});

test("the funnel counts every order opened in the window, converted or not", opts, async () => {
  await seedOrder({ amountMinor: 49_900, createdAt: MIDDAY_DAY_3, status: "failed" });
  await seedOrder({ amountMinor: 49_900, createdAt: MIDDAY_DAY_3, status: "created" });

  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(summary.funnel.ordersCreated, 12);
  assert.equal(summary.funnel.ordersPaid, 9);
  assert.equal(summary.funnel.ordersFailed, 1);
  assert.equal(summary.funnel.ordersExpired, 1);
  assert.equal(summary.funnel.conversionRate, 0.75);

  // An order opened OUTSIDE the window is not in the funnel even if it is live.
  const narrow = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_1) });
  assert.equal(narrow.funnel.ordersCreated, 2);
});

test("MRR amortises a live prepaid term and ignores one that has lapsed", opts, async () => {
  const before = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });

  const active = await seedOrder({
    subject: "mathematics",
    termMonths: 12,
    amountMinor: 1_200_000,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
  });
  // Bring its access window into the present; the run rate is a snapshot of NOW.
  await rawPool().query(`UPDATE payments.orders SET paid_at = NOW() - INTERVAL '1 day' WHERE id = $1`, [
    active.orderId,
  ]);

  const lapsed = await seedOrder({
    subject: "mathematics",
    termMonths: 1,
    amountMinor: 500_000,
    createdAt: MIDDAY_DAY_3,
    capturedAt: MIDDAY_DAY_3,
  });
  await rawPool().query(`UPDATE payments.orders SET paid_at = NOW() - INTERVAL '90 days' WHERE id = $1`, [
    lapsed.orderId,
  ]);

  const after = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(
    after.mrr.prepaidNormalisedMinor - before.mrr.prepaidNormalisedMinor,
    100_000,
    "₹12,000 over 12 months is ₹1,000 a month; the lapsed term contributes nothing",
  );
  assert.equal(after.mrr.activePrepaidOrders - before.mrr.activePrepaidOrders, 1);
  assert.equal(after.mrr.totalMinor, after.mrr.recurringMinor + after.mrr.prepaidNormalisedMinor);
  assert.equal(after.mrr.subscriptionsAvailable, true);
});

test("the ledger browser filters, paginates and reconciles with the summary", opts, async () => {
  const base: LedgerFilters = {
    livemode: true,
    statuses: [],
    kinds: [],
    subject: null,
    couponCode: null,
    userId: null,
    search: null,
    fromIso: liveRange(DAY_1, DAY_3).fromIso,
    toIso: liveRange(DAY_1, DAY_3).toIso,
    limit: 50,
    offset: 0,
  };

  const all = await listLedger(base);
  const summary = await getPaymentsSummary({ livemode: true, range: liveRange(DAY_1, DAY_3) });
  assert.equal(all.total, summary.funnel.ordersCreated, "the browser and the funnel see the same orders");
  assert.equal(all.rows.length, all.total);
  assert.ok(all.rows.every((row) => row.livemode === true), "test-mode orders never leak into the live browser");

  const paid = await listLedger({ ...base, statuses: ["paid"] });
  assert.equal(paid.total, summary.funnel.ordersPaid);

  const expired = await listLedger({ ...base, statuses: ["expired", "failed"] });
  assert.equal(expired.total, 2);

  const byCoupon = await listLedger({ ...base, couponCode: couponCode.toLowerCase() });
  assert.equal(byCoupon.total, 3, "the coupon filter is case-insensitive and includes the unpaid order");

  const bySubject = await listLedger({ ...base, subject: "biology" });
  assert.equal(bySubject.total, 1);
  assert.equal(bySubject.rows[0].subject, "biology");

  const byUser = await listLedger({ ...base, userId: otherStudentId });
  assert.equal(byUser.total, 1);

  const captured = all.rows.find((row) => row.razorpayPaymentId);
  assert.ok(captured?.razorpayPaymentId);
  const bySearch = await listLedger({ ...base, search: captured.razorpayPaymentId });
  assert.equal(bySearch.total, 1);
  assert.equal(bySearch.rows[0].orderId, captured.orderId);

  const byEmail = await listLedger({ ...base, search: studentId });
  assert.ok(byEmail.total > 0, "the seeded email contains the student id, so the free-text join works");

  // One captured charge per order — the LATERAL join must never multiply rows.
  assert.equal(new Set(all.rows.map((row) => row.orderId)).size, all.rows.length);
  assert.equal(
    all.rows.filter((row) => row.razorpayPaymentId).length,
    summary.totals.payments,
    "one browser row per captured charge — the paid-but-uncharged order shows none",
  );

  const firstPage = await listLedger({ ...base, limit: 3, offset: 0 });
  assert.equal(firstPage.rows.length, 3);
  assert.equal(firstPage.hasMore, true);
  const secondPage = await listLedger({ ...base, limit: 3, offset: 3 });
  assert.equal(secondPage.rows.length, 3);
  assert.equal(
    new Set([...firstPage.rows, ...secondPage.rows].map((row) => row.orderId)).size,
    6,
    "pages must not overlap",
  );
  const lastPage = await listLedger({ ...base, limit: 50, offset: all.total });
  assert.equal(lastPage.rows.length, 0);
  assert.equal(lastPage.hasMore, false);

  // Sorted newest first.
  const times = all.rows.map((row) => Date.parse(row.createdAt));
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test("a mandate charge with no order is reported rather than silently hidden", opts, async () => {
  const orphanId = `pay_ph8_orphan_${Date.now().toString(36)}`;
  paymentIds.push(orphanId);
  await upsertPayment({
    razorpayPaymentId: orphanId,
    orderId: null,
    subscriptionId: `sub_ph8_${Date.now().toString(36)}`,
    userId: studentId,
    amountMinor: 49_900,
    currency: "INR",
    method: "upi",
    status: "captured",
    livemode: true,
    capturedAt: new Date(MIDDAY_DAY_3),
  });

  const range = liveRange(DAY_1, DAY_3);
  const page = await listLedger({
    livemode: true,
    statuses: [],
    kinds: [],
    subject: null,
    couponCode: null,
    userId: null,
    search: null,
    fromIso: range.fromIso,
    toIso: range.toIso,
    limit: 50,
    offset: 0,
  });
  assert.ok(page.subscriptionCharges >= 1, "the orderless charge is surfaced as a count");

  const summary = await getPaymentsSummary({ livemode: true, range });
  assert.equal(summary.totals.payments, 11, "it is still counted as revenue");
  const unattributed = summary.byKind.find((slice) => slice.key === "unattributed");
  assert.equal(unattributed?.grossMinor, 49_900, "with no mandate row it lands in its own bucket");
});

test("CSV export carries the same rows and defuses a formula in a buyer name", opts, async () => {
  await rawPool().query(`UPDATE origin_users SET name = $2 WHERE id = $1`, [
    studentId,
    "=HYPERLINK(\"http://evil\")",
  ]);
  const range = liveRange(DAY_1, DAY_3);
  const page = await listLedger({
    livemode: true,
    statuses: ["paid"],
    kinds: [],
    subject: null,
    couponCode: null,
    userId: null,
    search: null,
    fromIso: range.fromIso,
    toIso: range.toIso,
    limit: 5_000,
    offset: 0,
  });
  const csv = ledgerToCsv(page.rows);
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines.length, page.rows.length + 1);
  assert.ok(lines[0].startsWith('"order_id"'));
  for (const row of page.rows) {
    assert.ok(csv.includes(`"${row.orderId}"`), row.orderId);
  }
  assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`), "the formula is quoted AND prefixed");
  assert.ok(!/\n"?=/.test(csv), "no cell may begin a line with a bare =");
});

test("teardown: remove the historical Phase 8 fixtures", opts, async () => {
  const pool = rawPool();
  if (refundIds.length) {
    await pool.query(`DELETE FROM payments.refunds WHERE razorpay_refund_id = ANY($1)`, [refundIds]);
  }
  if (paymentIds.length) {
    await pool.query(`DELETE FROM payments.payments WHERE razorpay_payment_id = ANY($1)`, [paymentIds]);
  }
  if (orderIds.length) {
    await pool.query(`DELETE FROM entitlements.subject_grants WHERE order_id = ANY($1)`, [orderIds]);
    await pool.query(`DELETE FROM payments.orders WHERE id = ANY($1)`, [orderIds]);
  }
  if (couponCode) {
    await pool.query(`DELETE FROM pricing.coupon_redemptions WHERE code = $1`, [couponCode]);
    await pool.query(`DELETE FROM pricing.coupons WHERE code = $1`, [couponCode]);
  }
  await cleanup(fixtures);
  await closePool();
});

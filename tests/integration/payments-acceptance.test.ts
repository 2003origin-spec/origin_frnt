/**
 * Database-backed acceptance for the invariants Phase 3–5 could not verify.
 *
 * The Phase 5 record (§16.5) lists these as explicitly pending because no
 * Postgres was reachable in that environment: duplicate reservation
 * idempotency, `max_redemptions=1` contention, per-user limits, commit/release
 * exactly-once counters, expired-hold slot reuse, and bundle grant persistence.
 * They are all SQL-level guarantees, so unit tests cannot stand in for them.
 *
 * Everything here exercises real row locks, partial unique indexes and
 * transactions against a live database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const opts = { skip: !dbConfigured() ? "USER_DATABASE_URL not set" : false };

let userId = "";
let otherUserId = "";

const CAP1 = `ACC_CAP1_${Date.now().toString(36).toUpperCase()}`;
const PERUSER = `ACC_PU_${Date.now().toString(36).toUpperCase()}`;
const HOLD = `ACC_HOLD_${Date.now().toString(36).toUpperCase()}`;
const COUNTER = `ACC_CNT_${Date.now().toString(36).toUpperCase()}`;

async function seedUser(prefix: string): Promise<string> {
  const id = makeId(prefix);
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, password_hash, role)
     VALUES ($1, 'Acceptance', $2, 'test-only', 'student')`,
    [id, `${id}@example.test`],
  );
  return id;
}

async function timesRedeemed(code: string): Promise<number> {
  const { rows } = await rawPool().query(`SELECT times_redeemed FROM pricing.coupons WHERE code = $1`, [code]);
  return Number(rows[0]?.times_redeemed ?? -1);
}

async function stateCounts(code: string): Promise<Record<string, number>> {
  const { rows } = await rawPool().query(
    `SELECT state, COUNT(*)::int AS n FROM pricing.coupon_redemptions WHERE code = $1 GROUP BY state`,
    [code],
  );
  return Object.fromEntries(rows.map((r) => [r.state, Number(r.n)]));
}

test("setup", opts, async () => {
  const { ensurePaymentsAndGrantSchema } = await import("@/server/payments/payments-schema");
  await ensurePaymentsAndGrantSchema();
  userId = await seedUser("user_acc");
  otherUserId = await seedUser("user_acc2");
  await rawPool().query(
    `INSERT INTO pricing.coupons (code, kind, value, applies_to, max_redemptions, per_user_limit, active)
     VALUES ($1,'percent',50,'subject',1,5,TRUE),
            ($2,'percent',50,'subject',NULL,1,TRUE),
            ($3,'percent',50,'subject',1,5,TRUE),
            ($4,'flat',10000,'subject',NULL,5,TRUE)`,
    [CAP1, PERUSER, HOLD, COUNTER],
  );
});

test("duplicate reservation for one order is idempotent — the cap is charged once", opts, async () => {
  const { reserveCoupon } = await import("@/server/pricing/coupons-service");
  const orderId = makeId("ord_dup");

  const first = await reserveCoupon({
    code: COUNTER, userId, subject: "physics", targetKind: "subject",
    orderId, amountDiscountedMinor: 10000,
  });
  const after1 = await timesRedeemed(COUNTER);

  // A retried checkout with the same order must not consume a second slot.
  const second = await reserveCoupon({
    code: COUNTER, userId, subject: "physics", targetKind: "subject",
    orderId, amountDiscountedMinor: 10000,
  });
  assert.equal(second.id, first.id, "same reservation row is returned");
  assert.equal(await timesRedeemed(COUNTER), after1, "times_redeemed did not double-count");
});

test("max_redemptions=1 under real concurrency admits exactly one holder", opts, async () => {
  const { reserveCoupon } = await import("@/server/pricing/coupons-service");
  // Eight simultaneous checkouts from eight different students for the last unit.
  const users = await Promise.all([...Array(8)].map(() => seedUser("user_race")));
  const settled = await Promise.allSettled(
    users.map((uid) =>
      reserveCoupon({
        code: CAP1, userId: uid, subject: "physics", targetKind: "subject",
        orderId: makeId("ord_race"), amountDiscountedMinor: 10000,
      }),
    ),
  );
  const won = settled.filter((s) => s.status === "fulfilled");
  assert.equal(won.length, 1, `exactly one reservation may win, got ${won.length}`);
  assert.equal(await timesRedeemed(CAP1), 1, "the global counter matches the winners");
  const counts = await stateCounts(CAP1);
  assert.equal(counts.reserved ?? 0, 1, "exactly one held row exists");
});

test("per_user_limit=1 stops the same student reusing a code on a second order", opts, async () => {
  const { commitCouponReservation, reserveCoupon } = await import("@/server/pricing/coupons-service");
  const firstOrder = makeId("ord_pu");
  await reserveCoupon({
    code: PERUSER, userId, subject: "physics", targetKind: "subject",
    orderId: firstOrder, amountDiscountedMinor: 10000,
  });
  await commitCouponReservation({ code: PERUSER, userId, orderId: firstOrder });

  await assert.rejects(
    () =>
      reserveCoupon({
        code: PERUSER, userId, subject: "physics", targetKind: "subject",
        orderId: makeId("ord_pu2"), amountDiscountedMinor: 10000,
      }),
    /already used this coupon/i,
  );

  // A DIFFERENT student is unaffected (the limit is per user, not global).
  const other = await reserveCoupon({
    code: PERUSER, userId: otherUserId, subject: "physics", targetKind: "subject",
    orderId: makeId("ord_pu3"), amountDiscountedMinor: 10000,
  });
  assert.ok(other.id, "another student may still use the code");
});

test("commit and release are each exactly-once against the counter", opts, async () => {
  const { commitCouponReservation, releaseCouponReservation, reserveCoupon } =
    await import("@/server/pricing/coupons-service");

  // Commit twice: the second must be a no-op.
  const committedOrder = makeId("ord_commit");
  const uid = await seedUser("user_cnt");
  await reserveCoupon({
    code: COUNTER, userId: uid, subject: "physics", targetKind: "subject",
    orderId: committedOrder, amountDiscountedMinor: 10000,
  });
  const beforeCommit = await timesRedeemed(COUNTER);
  assert.equal(await commitCouponReservation({ code: COUNTER, userId: uid, orderId: committedOrder }), true);
  assert.equal(
    await commitCouponReservation({ code: COUNTER, userId: uid, orderId: committedOrder }),
    false,
    "a second commit reports no transition",
  );
  assert.equal(await timesRedeemed(COUNTER), beforeCommit, "commit never changes the counter");

  // Release twice: the slot returns exactly once.
  const releasedOrder = makeId("ord_release");
  const uid2 = await seedUser("user_cnt2");
  await reserveCoupon({
    code: COUNTER, userId: uid2, subject: "physics", targetKind: "subject",
    orderId: releasedOrder, amountDiscountedMinor: 10000,
  });
  const held = await timesRedeemed(COUNTER);
  assert.equal(await releaseCouponReservation({ code: COUNTER, userId: uid2, orderId: releasedOrder }), true);
  assert.equal(await timesRedeemed(COUNTER), held - 1, "release returned exactly one slot");
  assert.equal(
    await releaseCouponReservation({ code: COUNTER, userId: uid2, orderId: releasedOrder }),
    false,
    "a second release reports no transition",
  );
  assert.equal(await timesRedeemed(COUNTER), held - 1, "the counter did not drift below the held count");

  // A COMMITTED reservation must not be releasable — that would refund a slot
  // for a purchase that actually completed.
  assert.equal(
    await releaseCouponReservation({ code: COUNTER, userId: uid, orderId: committedOrder }),
    false,
    "a committed redemption cannot be released",
  );
});

test("an expired hold returns its slot to the next student", opts, async () => {
  const { reserveCoupon } = await import("@/server/pricing/coupons-service");
  const abandonedOrder = makeId("ord_hold");
  await reserveCoupon({
    code: HOLD, userId, subject: "physics", targetKind: "subject",
    orderId: abandonedOrder, amountDiscountedMinor: 10000,
  });
  assert.equal(await timesRedeemed(HOLD), 1, "the cap of 1 is now consumed");

  // The student abandoned checkout; age the hold past its expiry.
  await rawPool().query(
    `UPDATE pricing.coupon_redemptions SET expires_at = NOW() - INTERVAL '1 minute'
      WHERE code = $1 AND order_id = $2`,
    [HOLD, abandonedOrder],
  );

  // The next student must be able to take the freed slot.
  const next = await reserveCoupon({
    code: HOLD, userId: otherUserId, subject: "physics", targetKind: "subject",
    orderId: makeId("ord_hold2"), amountDiscountedMinor: 10000,
  });
  assert.ok(next.id, "the expired hold was swept and its slot reused");
  assert.equal(await timesRedeemed(HOLD), 1, "the counter still reflects exactly one live hold");
  const counts = await stateCounts(HOLD);
  assert.equal(counts.released ?? 0, 1, "the abandoned hold was released");
  assert.equal(counts.reserved ?? 0, 1, "exactly one live hold remains");
});

test("two racing webhooks for ONE payment produce one grant and one receipt", opts, async () => {
  const { applyPaymentSuccess } = await import("@/server/payments/orders-service");
  const { attachRazorpayOrderId, insertOrder, newOrderId } = await import("@/server/payments/payments-store");
  const uid = await seedUser("user_race2");
  const order = await insertOrder({
    id: newOrderId(), userId: uid, kind: "subject_term", subject: "physics",
    termMonths: 3, baseAmountMinor: 134700, discountMinor: 0, amountMinor: 134700,
    currency: "INR", livemode: false,
  });
  await attachRazorpayOrderId(order.id, `order_race_${order.id}`);
  const paymentId = `pay_race_${order.id}`;

  // payment.captured and order.paid arrive at the same instant.
  const settled = await Promise.allSettled([
    applyPaymentSuccess({ orderId: order.id, razorpayPaymentId: paymentId, amountMinor: 134700 }),
    applyPaymentSuccess({ orderId: order.id, razorpayPaymentId: paymentId, amountMinor: 134700 }),
  ]);
  const ok = settled.filter((s) => s.status === "fulfilled");
  assert.ok(ok.length >= 1, "at least one delivery applied");

  const grants = await rawPool().query(
    `SELECT COUNT(*)::int AS n FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = 'physics' AND source = 'paid_order' AND status = 'active'`,
    [uid],
  );
  assert.equal(grants.rows[0].n, 1, "exactly one active paid grant");

  const payments = await rawPool().query(
    `SELECT COUNT(*)::int AS n FROM payments.payments WHERE order_id = $1`,
    [order.id],
  );
  assert.equal(payments.rows[0].n, 1, "exactly one payment row");

  const outbox = await rawPool().query(
    `SELECT COUNT(*)::int AS n FROM payments.outbox WHERE id = $1`,
    [`payment_receipt_${paymentId}`],
  );
  assert.equal(outbox.rows[0].n, 1, "exactly one receipt was enqueued — the student is not emailed twice");

  // The term must be ONE term, not two: a doubled grant would hand out 6 months.
  const expiry = await rawPool().query(
    `SELECT expires_at FROM entitlements.subject_grants
      WHERE user_id = $1 AND subject = 'physics' AND source = 'paid_order' AND status = 'active'`,
    [uid],
  );
  const months = (new Date(expiry.rows[0].expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30);
  assert.ok(months > 2.5 && months < 3.6, `expected ~3 months of access, got ~${months.toFixed(2)}`);
});

test("a bundle order grants exactly its snapshotted subjects, never all four", opts, async () => {
  const { applyPaymentSuccess } = await import("@/server/payments/orders-service");
  const { attachRazorpayOrderId, insertOrder, newOrderId } = await import("@/server/payments/payments-store");
  const uid = await seedUser("user_bundle2");
  // A two-subject bundle. If the grant path ever fell back to ALL_SUBJECTS this
  // student would receive two subjects they never paid for.
  const order = await insertOrder({
    id: newOrderId(), userId: uid, kind: "bundle_term", bundleId: "acc-bundle",
    termMonths: 1, baseAmountMinor: 99900, discountMinor: 0, amountMinor: 99900,
    currency: "INR", livemode: false,
    notes: { bundle_subjects: ["physics", "chemistry"] },
  });
  await attachRazorpayOrderId(order.id, `order_bundle_${order.id}`);
  await applyPaymentSuccess({
    orderId: order.id, razorpayPaymentId: `pay_bundle_${order.id}`, amountMinor: 99900,
  });

  const { rows } = await rawPool().query(
    `SELECT subject FROM entitlements.subject_grants
      WHERE user_id = $1 AND source = 'paid_order' AND status = 'active' ORDER BY subject`,
    [uid],
  );
  assert.deepEqual(
    rows.map((r) => r.subject),
    ["chemistry", "physics"],
    "only the purchased subjects were granted",
  );
});


test("an admin can change a price with NO Razorpay credentials configured", opts, async () => {
  // Production currently has zero RAZORPAY_* variables, and Phase 10 test-mode
  // validation starts from that state. Rail A is server-priced, so a price edit
  // must not depend on a live provider credential.
  const { setSubjectPrice, getSubjectPriceResolved } = await import("@/server/pricing/pricing-service");
  const saved: Record<string, string | undefined> = {};
  for (const k of ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET"]) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  try {
    const updated = await setSubjectPrice({
      subject: "mathematics",
      amountMinor: 59900,
      listAmountMinor: 99900,
      adminUserId: userId,
    });
    assert.equal(updated.amountMinor, 59900, "the admin's price was saved");
    assert.equal(updated.listAmountMinor, 99900, "the struck-through MRP was saved");

    // And it is what the student-facing resolver returns.
    const resolved = await getSubjectPriceResolved("mathematics");
    assert.equal(resolved.amountMinor, 59900);
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test("re-editing a price does not mint a second Razorpay plan for the same amount", opts, async () => {
  // Razorpay plans cannot be deleted. Minting one per edit — the pre-review
  // behaviour — grows the account without bound.
  const before = await rawPool().query(`SELECT COUNT(*)::int AS n FROM pricing.razorpay_plans`);
  const { setSubjectPrice } = await import("@/server/pricing/pricing-service");
  await setSubjectPrice({ subject: "biology", amountMinor: 44900, adminUserId: userId });
  await setSubjectPrice({ subject: "biology", amountMinor: 44900, adminUserId: userId });
  const after = await rawPool().query(`SELECT COUNT(*)::int AS n FROM pricing.razorpay_plans`);
  assert.equal(after.rows[0].n, before.rows[0].n, "no plan rows were added without credentials");
});

test("teardown", opts, async () => {
  await closePool();
});

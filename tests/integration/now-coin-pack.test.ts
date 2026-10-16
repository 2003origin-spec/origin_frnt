/**
 * Ori Coins pack through the real Razorpay one-time-order rail (stubbed
 * gateway): the server prices the pack, a promotion bonus is frozen into the
 * order, capture credits coins exactly once and grants NO premium subject,
 * and a full refund takes back only what is still spendable — freezing the
 * wallet when coins were already spent.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { sessionHold } from "@/server/now/ledger-rules";
import { getWalletBalance, postTransfers } from "@/server/now/ledger-store";
import { ensureNowSchema } from "@/server/now/now-schema";
import { upsertCoinPack } from "@/server/now/wallet-service";
import {
  applyPaymentSuccess,
  createCheckoutOrder,
  type RazorpayOrder,
  type RazorpayOrdersClient,
} from "@/server/payments/orders-service";
import { applyRefundLifecycle } from "@/server/payments/refunds-service";
import { ensurePaymentsAndGrantSchema } from "@/server/payments/payments-schema";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();

function stubRazorpay(): RazorpayOrdersClient {
  return {
    orders: {
      async create(input): Promise<RazorpayOrder> {
        return { id: makeId("order_rzp"), amount: input.amount, currency: input.currency, status: "created" };
      },
    },
  };
}

test("a coin pack is priced by the server, credited once, and never grants premium", { skip: SKIP }, async () => {
  await ensurePaymentsAndGrantSchema();
  await ensureNowSchema();
  const pool = rawPool();
  const userId = makeId("now_buyer");
  await pool.query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES ($1, 'Coin Buyer', $2, 'student', 'x')`,
    [userId, `${userId}@example.com`],
  );
  const pack = await upsertCoinPack({ name: "Test 1000", coins: 1_000, pricePaise: 9_900 });
  const promoId = makeId("promo");
  await pool.query(
    `INSERT INTO now.promotions (id, kind, value, audience, starts_at, ends_at, bonus_expires_after_days)
     VALUES ($1, 'percent_on_pack', 50, 'all', NOW() - interval '1 hour', NOW() + interval '1 day', 30)`,
    [promoId],
  );
  try {
    const checkout = await createCheckoutOrder({
      userId,
      kind: "coin_pack",
      packId: pack.id,
      subject: "",
      termMonths: 1,
      idempotencyKey: makeId("idem"),
      razorpayClient: stubRazorpay(),
      keyId: "rzp_test_now",
    });
    assert.equal(checkout.amountMinor, 9_900, "price comes from now.coin_packs");
    assert.equal(checkout.order.kind, "coin_pack");
    assert.equal(checkout.order.notes.pack_coins, 1_000);
    assert.equal(checkout.order.notes.bonus_coins, 500, "50% promotion frozen into the order");

    const paymentId = makeId("pay");
    const capture = () =>
      applyPaymentSuccess({
        orderId: checkout.orderId,
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: paymentId,
        amountMinor: checkout.amountMinor,
        currency: "INR",
        method: "upi",
      });
    const first = await capture();
    assert.equal(first.grants.length, 0, "a coin pack grants no subject entitlement");
    await capture();
    assert.equal((await getWalletBalance(userId)).available, 1_500, "coins credited exactly once across a replay");

    const grants = await pool.query(`SELECT count(*)::int AS n FROM entitlements.subject_grants WHERE user_id = $1`, [userId]);
    assert.equal(grants.rows[0].n, 0);

    // Spend 400, then a full refund arrives from Razorpay.
    await postTransfers([sessionHold(userId, makeId("req"), 400)]);
    const refund = await applyRefundLifecycle({
      razorpayRefundId: makeId("rfnd"),
      razorpayPaymentId: paymentId,
      amountMinor: checkout.amountMinor,
      status: "processed",
      reason: "test full refund",
    });
    assert.equal(refund.isFull, true);
    assert.equal((await getWalletBalance(userId)).available, 0, "everything still spendable was taken back");
    const account = await pool.query(`SELECT frozen FROM now.accounts WHERE id = $1`, [`user:${userId}`]);
    assert.equal(account.rows[0].frozen, true, "a spent shortfall freezes the wallet");
    const shortfall = await pool.query(
      `SELECT payload FROM now.events WHERE type = 'wallet.refund_shortfall' AND payload->>'orderId' = $1`,
      [checkout.orderId],
    );
    assert.equal(shortfall.rows[0]?.payload.shortfall, 400);
  } finally {
    await pool.query(`DELETE FROM now.promotions WHERE id = $1`, [promoId]);
    await closePool();
  }
});

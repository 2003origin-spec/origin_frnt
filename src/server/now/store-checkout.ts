/**
 * Store items with a rupee price (decision B92), the store side: starting a
 * checkout and giving back what an unpaid one held.
 *
 * Checkout = place the store order (coins taken, stock reserved, rupee price
 * frozen) in one transaction, then open a `store_item` payment order on the
 * existing Razorpay one-time rail. The browser pays through Razorpay Checkout
 * and /api/payments/verify; applyPaymentSuccess hands the item over in its
 * own transaction (store-payments.ts). If the payment never completes, the
 * sweep releases the order after 45 minutes: coins back, stock back. Never
 * inside the Android app (Play billing policy).
 */

import { createCheckoutOrder, type RazorpayOrdersClient } from "@/server/payments/orders-service";
import { getUserPostgresPool } from "@/server/user-postgres";

import { logEvent } from "./dispatch-service";
import { storeRefund } from "./ledger-rules";
import { postTransfers, withNowTransaction } from "./ledger-store";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { CHECKOUT_RELEASE_MS, allowedItemKinds } from "./store-rules";
import { ensureStoreItemOrderKind } from "./store-payments";
import {
  assertStoreAccess,
  ensureCoinRedemptionGrantSource,
  getOrder,
  placeStoreOrderLocked,
  returnStoreStockLocked,
  type ItemRow,
  type MerchChoice,
  type StoreOrderView,
} from "./store-service";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type StoreCheckout =
  | {
      state: "pay";
      storeOrderId: string;
      orderId: string;
      razorpayOrderId: string | null;
      amountMinor: number;
      currency: string;
      keyId: string | null;
      coins: number;
      title: string;
    }
  | { state: "done"; order: StoreOrderView; alreadyOwned: boolean };

/** Test seam: a fake Razorpay client and key id, as createCheckoutOrder takes. */
export type CheckoutGateway = { razorpayClient?: RazorpayOrdersClient; keyId?: string };

/**
 * Starts (or, with the same Idempotency-Key, resumes) a checkout for an item
 * with a rupee price. "done" when there is nothing to pay (an owned paper, or
 * an order already paid).
 */
export async function startStoreCheckout(
  userId: string,
  itemId: string,
  idempotencyKey: string,
  merch: MerchChoice = {},
  now: Date = new Date(),
  gateway: CheckoutGateway = {},
): Promise<StoreCheckout> {
  await assertStoreAccess(userId);
  const { features } = await getNowSettings();
  if (!features.rupeePrices) throw new NowError(404, "not_on_sale", "That item is not on sale.");
  // DDL outside any transaction: the payment kind, and the premium grant source used at capture.
  await ensureStoreItemOrderKind();
  await ensureCoinRedemptionGrantSource();
  const kinds = allowedItemKinds(features);

  let storeOrderId = "";
  let title = "";
  let alreadyOwned = false;
  await withNowTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(`SELECT id FROM store.orders WHERE user_id = $1 AND idempotency_key = $2`, [
      userId,
      idempotencyKey,
    ]);
    if (existing.rows[0]) {
      storeOrderId = existing.rows[0].id;
      return;
    }
    const item = (await client.query<ItemRow>(`SELECT * FROM store.items WHERE id = $1 FOR UPDATE`, [itemId])).rows[0];
    if (!item || !item.active || !kinds.includes(item.kind)) throw new NowError(404, "not_on_sale", "That item is not on sale.");
    if (item.price_paise <= 0) throw new NowError(409, "coins_only", "This item is paid in coins only. Use Buy.");
    title = item.title;
    const placed = await placeStoreOrderLocked(client, { userId, item, idempotencyKey, now, merch });
    storeOrderId = placed.orderId;
    alreadyOwned = placed.alreadyOwned;
    if (!alreadyOwned) {
      await logEvent(client, { type: "store.checkout_started", actor: userId, payload: { storeOrderId, itemId, paise: item.price_paise } });
    }
  });

  const current = (await (await db()).query<{ status: string; payment_order_id: string | null; title: string; coins_spent: number }>(
    `SELECT o.status, o.payment_order_id, i.title, o.coins_spent FROM store.orders o JOIN store.items i ON i.id = o.item_id WHERE o.id = $1`,
    [storeOrderId],
  )).rows[0];
  if (alreadyOwned || current.status !== "placed") {
    if (current.status === "cancelled") throw new NowError(409, "checkout_expired", "That checkout has expired. Start again.");
    return { state: "done", order: (await getOrder(storeOrderId))!, alreadyOwned };
  }
  title = current.title;

  let checkout;
  try {
    checkout = await createCheckoutOrder({
      userId,
      kind: "store_item",
      storeOrderId,
      subject: "",
      termMonths: 1,
      // One payment order per store order: a retry resumes it instead of opening another.
      idempotencyKey: `store:${storeOrderId}`,
      razorpayClient: gateway.razorpayClient,
      keyId: gateway.keyId,
      now,
    });
  } catch (error) {
    // Nothing can be paid: give the coins and stock back now instead of after 45 minutes.
    await releaseStoreOrder(storeOrderId, "checkout_failed", now).catch(() => undefined);
    throw error;
  }
  await (await db()).query(
    `UPDATE store.orders SET payment_order_id = $2, razorpay_order_id = $3 WHERE id = $1 AND status = 'placed'`,
    [storeOrderId, checkout.orderId, checkout.razorpayOrderId],
  );
  return {
    state: "pay",
    storeOrderId,
    orderId: checkout.orderId,
    razorpayOrderId: checkout.razorpayOrderId,
    amountMinor: checkout.amountMinor,
    currency: checkout.currency,
    keyId: checkout.keyId,
    coins: current.coins_spent,
    title,
  };
}

/** Releases one unpaid store order: cancelled, coins back, stock back. False if it was no longer waiting. */
export async function releaseStoreOrder(storeOrderId: string, reason: string, now: Date = new Date()): Promise<boolean> {
  let released = false;
  await withNowTransaction(async (client) => {
    const res = await client.query<{ id: string; user_id: string; item_id: string; coins_spent: number; size: string | null; status: string }>(
      `SELECT id, user_id, item_id, coins_spent, size, status FROM store.orders WHERE id = $1 FOR UPDATE`,
      [storeOrderId],
    );
    const order = res.rows[0];
    if (!order || order.status !== "placed") return;
    await client.query(`UPDATE store.orders SET status = 'cancelled', cancelled_at = $2, cancel_reason = $3 WHERE id = $1`, [
      order.id,
      now,
      reason,
    ]);
    if (order.coins_spent > 0) await postTransfers([storeRefund(order.user_id, order.coins_spent, order.id)], { client, now });
    await returnStoreStockLocked(client, order.item_id, order.size);
    await logEvent(client, { type: "store.checkout_released", actor: "system", payload: { storeOrderId: order.id, reason, coins: order.coins_spent } });
    released = true;
  });
  return released;
}

/**
 * Sweep: unpaid store orders whose payment failed or expired, or that have
 * waited 45 minutes (the payment order lives 30), are released. A payment
 * that still arrives later is logged for an admin to refund (store-payments).
 */
export async function releaseUnpaidStoreOrders(now: Date = new Date()): Promise<number> {
  const pool = await db();
  const due = await pool.query<{ id: string; payment_status: string | null }>(
    `SELECT o.id, p.status::text AS payment_status
       FROM store.orders o LEFT JOIN payments.orders p ON p.id = o.payment_order_id
      WHERE o.status = 'placed' AND o.paise_paid > 0
        AND (o.created_at <= $1 OR p.status::text IN ('failed', 'expired'))
        AND (p.status IS NULL OR p.status::text NOT IN ('paid', 'refunded', 'partially_refunded'))
      ORDER BY o.created_at LIMIT 50`,
    [new Date(now.getTime() - CHECKOUT_RELEASE_MS)],
  ).catch((error: { code?: string }) => {
    // payments.* not created yet (no payment ever made here): nothing can be waiting.
    if (error.code === "42P01") return { rows: [] as { id: string; payment_status: string | null }[] };
    throw error;
  });
  let released = 0;
  for (const row of due.rows) {
    const reason = row.payment_status === "failed" || row.payment_status === "expired" ? `payment_${row.payment_status}` : "payment_not_completed";
    if (await releaseStoreOrder(row.id, reason, now).catch(() => false)) released += 1;
  }
  return released;
}

/** For the store screen after Razorpay closes: the order as it stands now. */
export async function getStoreCheckoutOrder(userId: string, storeOrderId: string): Promise<StoreOrderView> {
  const res = await (await db()).query<{ user_id: string }>(`SELECT user_id FROM store.orders WHERE id = $1`, [storeOrderId]);
  if (res.rows[0]?.user_id !== userId) throw new NowError(404, "not_found", "Order not found.");
  return (await getOrder(storeOrderId))!;
}

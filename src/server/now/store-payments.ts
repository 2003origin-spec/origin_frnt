/**
 * Store items with a rupee price (decision B92), the payment side: called by
 * the payments code (orders-service) to price a `store_item` order and,
 * inside applyPaymentSuccess's own transaction, to hand the item over, so a
 * captured payment and the item commit together or not at all — the same
 * shape as coin packs (coin-pack-payments.ts).
 *
 * Kept free of any payments import so orders-service can import it.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureNowSchema } from "./now-schema";
import { fulfilStoreOrderLocked, type ItemRow } from "./store-service";

/** Adds `store_item` to payments.order_kind. Must run outside any transaction that uses it. */
export async function ensureStoreItemOrderKind(): Promise<void> {
  const pool = getUserPostgresPool();
  if (!pool || globalThis.__originStoreItemKindEnsured) return;
  await pool.query(`ALTER TYPE payments.order_kind ADD VALUE IF NOT EXISTS 'store_item'`);
  globalThis.__originStoreItemKindEnsured = true;
}

declare global {
  var __originStoreItemKindEnsured: boolean | undefined;
}

export type ResolvedStoreOrder = { storeOrderId: string; title: string; amountMinor: number; coins: number };

/** The rupee amount of a placed store order (frozen when it was placed); the request never supplies one. */
export async function resolveStoreOrderAmount(input: { storeOrderId: string; userId: string }): Promise<ResolvedStoreOrder> {
  await ensureNowSchema();
  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");
  const res = await pool.query<{ id: string; user_id: string; status: string; paise_paid: number; coins_spent: number; title: string }>(
    `SELECT o.id, o.user_id, o.status, o.paise_paid, o.coins_spent, i.title
       FROM store.orders o JOIN store.items i ON i.id = o.item_id WHERE o.id = $1`,
    [input.storeOrderId],
  );
  const row = res.rows[0];
  if (!row || row.user_id !== input.userId) throw Object.assign(new Error("Store order not found."), { status: 404 });
  if (row.status !== "placed" || row.paise_paid <= 0) {
    throw Object.assign(new Error("This store order is not waiting for a payment."), { status: 409 });
  }
  return { storeOrderId: row.id, title: row.title, amountMinor: row.paise_paid, coins: row.coins_spent };
}

/** Order notes written at checkout; read back at capture. */
export function storeOrderNotes(order: ResolvedStoreOrder): Record<string, string | number> {
  return { store_order_id: order.storeOrderId, store_coins: order.coins };
}

export type StorePaymentOutcome = { outcome: "fulfilled" | "already" | "released"; premiumGranted: boolean; storeOrderId: string | null };

/**
 * Hands over the store order behind a captured `store_item` payment, inside
 * the caller's payment transaction. Idempotent: a second capture finds the
 * order already handed over. A payment that arrives after the unpaid order
 * was released (coins and stock already back) is logged for an admin to
 * refund in Razorpay; the payment itself still records as paid.
 */
export async function completeStoreItemPayment(
  client: PoolClient,
  input: { notes: Record<string, unknown>; userId: string; paymentOrderId: string; amountMinor: number; now: Date },
): Promise<StorePaymentOutcome> {
  const storeOrderId = typeof input.notes.store_order_id === "string" ? input.notes.store_order_id : null;
  if (!storeOrderId) throw new Error("Store order payment is missing its store order");
  const res = await client.query<{ id: string; user_id: string; item_id: string; status: string }>(
    `SELECT id, user_id, item_id, status FROM store.orders WHERE id = $1 FOR UPDATE`,
    [storeOrderId],
  );
  const order = res.rows[0];
  if (!order || order.user_id !== input.userId) throw new Error("Store order payment refers to an unknown store order");
  if (order.status !== "placed") {
    if (order.status === "cancelled") {
      await client.query(`INSERT INTO now.events (type, actor, payload) VALUES ('store.paid_after_release', 'system', $1::jsonb)`, [
        JSON.stringify({ storeOrderId, paymentOrderId: input.paymentOrderId, amountMinor: input.amountMinor, userId: input.userId }),
      ]);
      return { outcome: "released", premiumGranted: false, storeOrderId };
    }
    return { outcome: "already", premiumGranted: false, storeOrderId };
  }
  const item = (await client.query<ItemRow>(`SELECT * FROM store.items WHERE id = $1 FOR UPDATE`, [order.item_id])).rows[0];
  if (!item) throw new Error("Store order payment refers to a missing item");
  const { premiumGranted } = await fulfilStoreOrderLocked(client, {
    orderId: storeOrderId,
    userId: input.userId,
    item,
    now: input.now,
    paisePaid: input.amountMinor,
    paymentOrderId: input.paymentOrderId,
  });
  return { outcome: "fulfilled", premiumGranted, storeOrderId };
}

/** A full refund of a store payment: logged for an admin (the item may already be in use or shipped). */
export async function onStoreItemRefunded(client: PoolClient, input: { paymentOrderId: string; notes: Record<string, unknown> }): Promise<void> {
  await client.query(`INSERT INTO now.events (type, actor, payload) VALUES ('store.payment_refunded', 'system', $1::jsonb)`, [
    JSON.stringify({ paymentOrderId: input.paymentOrderId, storeOrderId: input.notes.store_order_id ?? null }),
  ]);
}

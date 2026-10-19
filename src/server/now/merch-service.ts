/**
 * Merch with delivery (decision B91): after a merch order is paid with coins
 * (store-service buyStoreItem), the team packs, ships (courier + tracking
 * number) and marks it delivered here. An order cancelled before it ships
 * gives the coins back and returns the stock. Delivery addresses are wiped
 * 90 days after delivery or cancellation (the nightly job).
 *
 * No courier integration: the team ships by hand and types the tracking
 * number in. Rules live in store-rules.ts.
 */

import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

import { sendEmail } from "@/server/email";
import { detailsCard, paragraph, renderEmail } from "@/server/email/layout";
import { createPresignedR2PutUrl } from "@/server/media-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

import { logEvent } from "./dispatch-service";
import { storeRefund } from "./ledger-rules";
import { postTransfers, withNowTransaction } from "./ledger-store";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { firstNameOnly } from "./session-rules";
import { getOrder, storeImageUrl, type StoreOrderView } from "./store-service";
import {
  ADDRESS_KEEP_DAYS,
  MERCH_IMAGE_MAX_BYTES,
  merchImageObjectKey,
  nextShipStatus,
  validateShipment,
  type DeliveryAddress,
  type ShipAction,
  type ShipStatus,
} from "./store-rules";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type LockedOrder = {
  id: string;
  user_id: string;
  item_id: string;
  coins_spent: number;
  size: string | null;
  ship_status: ShipStatus | null;
};

async function lockMerchOrder(client: PoolClient, orderId: string): Promise<LockedOrder | null> {
  const res = await client.query<LockedOrder>(
    `SELECT id, user_id, item_id, coins_spent, size, ship_status FROM store.orders WHERE id = $1 AND ship_status IS NOT NULL FOR UPDATE`,
    [orderId],
  );
  return res.rows[0] ?? null;
}

/** Cancels a locked merch order: coins back, stock back. Caller checked the state. */
async function cancelLocked(client: PoolClient, order: LockedOrder, actor: string, reason: string, now: Date): Promise<void> {
  await client.query(
    `UPDATE store.orders SET ship_status = 'cancelled', status = 'cancelled', cancelled_at = $2, cancel_reason = $3 WHERE id = $1`,
    [order.id, now, reason],
  );
  if (order.coins_spent > 0) await postTransfers([storeRefund(order.user_id, order.coins_spent, order.id)], { client, now });
  if (order.size !== null) {
    await client.query(
      `UPDATE store.items SET size_stock = jsonb_set(size_stock, ARRAY[$2], to_jsonb(COALESCE((size_stock->>$2)::int, 0) + 1)), updated_at = NOW()
        WHERE id = $1 AND size_stock IS NOT NULL`,
      [order.item_id, order.size],
    );
  } else {
    await client.query(`UPDATE store.items SET stock = stock + 1, updated_at = NOW() WHERE id = $1 AND stock IS NOT NULL`, [order.item_id]);
  }
  await logEvent(client, { type: "store.cancelled", actor, payload: { orderId: order.id, coins: order.coins_spent, reason } });
}

/** The buyer cancels before the team starts packing. */
export async function cancelMyMerchOrder(userId: string, orderId: string, now: Date = new Date()): Promise<StoreOrderView> {
  await withNowTransaction(async (client) => {
    const order = await lockMerchOrder(client, orderId);
    if (!order || order.user_id !== userId) throw new NowError(404, "not_found", "Order not found.");
    if (order.ship_status !== "to_pack") {
      throw new NowError(409, "too_late", "This order is already being packed or shipped, so it cannot be cancelled here.");
    }
    await cancelLocked(client, order, userId, "Cancelled by the buyer", now);
  });
  return (await getOrder(orderId))!;
}

/** The most recent delivery address this user gave (to fill the form in again). */
export async function getLastDeliveryAddress(userId: string): Promise<DeliveryAddress | null> {
  const res = await (await db()).query<{ delivery: DeliveryAddress }>(
    `SELECT delivery FROM store.orders WHERE user_id = $1 AND delivery IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return res.rows[0]?.delivery ?? null;
}

// ---------------------------------------------------------------------------
// Admin.

export type MerchOrderRow = {
  id: string;
  title: string;
  size: string | null;
  coinsSpent: number;
  shipStatus: ShipStatus;
  courier: string | null;
  trackingNo: string | null;
  buyerName: string | null;
  buyerEmail: string | null;
  /** Full address for packing; null once wiped. */
  delivery: DeliveryAddress | null;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
};

export async function listMerchOrdersForAdmin(status: ShipStatus | null = null, limit = 200): Promise<MerchOrderRow[]> {
  const res = await (await db()).query<{
    id: string;
    title: string;
    size: string | null;
    coins_spent: number;
    ship_status: ShipStatus;
    courier: string | null;
    tracking_no: string | null;
    name: string | null;
    email: string | null;
    delivery: DeliveryAddress | null;
    created_at: Date;
    shipped_at: Date | null;
    delivered_at: Date | null;
    cancelled_at: Date | null;
    cancel_reason: string | null;
  }>(
    `SELECT o.id, i.title, o.size, o.coins_spent, o.ship_status, o.courier, o.tracking_no, u.name, u.email, o.delivery,
            o.created_at, o.shipped_at, o.delivered_at, o.cancelled_at, o.cancel_reason
       FROM store.orders o JOIN store.items i ON i.id = o.item_id JOIN origin_users u ON u.id = o.user_id
      WHERE o.ship_status IS NOT NULL AND ($1::text IS NULL OR o.ship_status = $1)
      ORDER BY o.created_at ${status === "to_pack" || status === "packed" ? "ASC" : "DESC"}
      LIMIT $2`,
    [status, Math.min(Math.max(limit, 1), 500)],
  );
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    size: r.size,
    coinsSpent: r.coins_spent,
    shipStatus: r.ship_status,
    courier: r.courier,
    trackingNo: r.tracking_no,
    buyerName: r.name,
    buyerEmail: r.email,
    delivery: r.delivery,
    createdAt: r.created_at.toISOString(),
    shippedAt: iso(r.shipped_at),
    deliveredAt: iso(r.delivered_at),
    cancelledAt: iso(r.cancelled_at),
    cancelReason: r.cancel_reason,
  }));
}

export type ShipmentInput = { courier?: string | null; trackingNo?: string | null; reason?: string | null };

/** Pack, ship (courier + tracking), deliver or cancel (coins back) one merch order. */
export async function updateMerchShipment(
  adminId: string,
  orderId: string,
  action: ShipAction,
  input: ShipmentInput = {},
  now: Date = new Date(),
): Promise<StoreOrderView> {
  let buyerId = "";
  let coins = 0;
  await withNowTransaction(async (client) => {
    const order = await lockMerchOrder(client, orderId);
    if (!order || !order.ship_status) throw new NowError(404, "not_found", "Merch order not found.");
    const next = nextShipStatus(order.ship_status, action);
    if (!next) throw new NowError(409, "invalid_state", `A ${order.ship_status.replace("_", " ")} order cannot be marked that way.`);
    buyerId = order.user_id;
    coins = order.coins_spent;
    if (action === "cancel") {
      const reason = (input.reason ?? "").trim();
      if (reason.length < 5 || reason.length > 300) throw new NowError(400, "reason_required", "Say why the order is cancelled (5 to 300 characters).");
      await cancelLocked(client, order, adminId, reason, now);
      return;
    }
    if (action === "ship") {
      const errors = validateShipment(input.courier, input.trackingNo);
      if (errors.length) throw new NowError(400, "invalid_shipment", errors.join(" "));
      await client.query(
        `UPDATE store.orders SET ship_status = 'shipped', courier = $2, tracking_no = $3, shipped_at = $4 WHERE id = $1`,
        [orderId, (input.courier ?? "").trim(), (input.trackingNo ?? "").trim(), now],
      );
    } else if (action === "deliver") {
      await client.query(
        `UPDATE store.orders SET ship_status = 'delivered', status = 'fulfilled', delivered_at = $2, fulfilled_at = $2 WHERE id = $1`,
        [orderId, now],
      );
    } else {
      await client.query(`UPDATE store.orders SET ship_status = $2 WHERE id = $1`, [orderId, next]);
    }
    await logEvent(client, { type: `store.${next}`, actor: adminId, payload: { orderId } });
  });
  const order = (await getOrder(orderId))!;
  if (action === "ship" || action === "cancel") await emailBuyer(buyerId, order, coins).catch(() => undefined);
  return order;
}

async function emailBuyer(userId: string, order: StoreOrderView, coins: number): Promise<void> {
  const res = await (await db()).query<{ email: string | null; name: string | null }>(`SELECT email, name FROM origin_users WHERE id = $1`, [userId]);
  const to = res.rows[0]?.email;
  if (!to) return;
  const first = firstNameOnly(res.rows[0]?.name ?? null);
  const item = `${order.title}${order.size ? ` (size ${order.size})` : ""}`;
  const shipped = order.shipStatus === "shipped";
  const subject = shipped ? `Your Origin order is on its way: ${order.title}` : `Your Origin order was cancelled: ${order.title}`;
  const lines = shipped
    ? [`Hi ${first},`, ``, `${item} has been shipped.`, `Courier: ${order.courier}`, `Tracking number: ${order.trackingNo}`, ``, `Track it on the courier's website.`]
    : [`Hi ${first},`, ``, `Your order for ${item} was cancelled, and ${coins} Ori Coins are back in your wallet.`];
  const html = renderEmail({
    preheader: shipped ? `${item} has been shipped.` : `${coins} Ori Coins are back in your wallet.`,
    documentTitle: "Origin - Store order",
    mascot: shipped ? "happy" : "curious",
    title: shipped ? "Your order is" : "Your order was",
    titleAccent: shipped ? "on its way" : "cancelled",
    intro: [shipped ? `${item} has been shipped.` : `${coins} Ori Coins are back in your wallet.`],
    blocks: shipped
      ? [
          detailsCard("Delivery", [
            { label: "Courier", value: order.courier ?? "" },
            { label: "Tracking number", value: order.trackingNo ?? "" },
            { label: "Delivering to", value: order.deliverTo ?? "" },
          ]),
          paragraph("Track it on the courier's website with the number above.", { muted: true, size: 13, align: "center" }),
        ]
      : [paragraph(`Your order for ${item} was cancelled.`, { align: "center" })],
    footerNote: "You received this because you ordered from the Origin Store.",
  });
  await sendEmail({ to, subject, text: lines.join("\n"), html });
}

// ---------------------------------------------------------------------------
// Product photos (public on purpose: they are shown to every buyer).

export async function createMerchImageUpload(itemId: string, input: { mimeType: string; sizeBytes: number }) {
  const pool = await db();
  const item = (await pool.query<{ kind: string }>(`SELECT kind FROM store.items WHERE id = $1`, [itemId])).rows[0];
  if (!item || item.kind !== "merch") throw new NowError(404, "not_found", "Merch item not found.");
  const objectKey = merchImageObjectKey(itemId, randomBytes(8).toString("hex"), input.mimeType);
  if (!objectKey || input.sizeBytes <= 0 || input.sizeBytes > MERCH_IMAGE_MAX_BYTES) {
    throw new NowError(400, "invalid_file", "Upload a JPG, PNG or WebP photo of 5 MB or less.");
  }
  const signed = createPresignedR2PutUrl({ objectKey, method: "PUT", expiresSeconds: 900 });
  return { uploadUrl: signed.url, objectKey, method: "PUT", contentType: input.mimeType };
}

export async function confirmMerchImage(itemId: string, objectKey: string) {
  if (!objectKey.startsWith(`origin-now/store-images/${itemId}/`)) {
    throw new NowError(400, "invalid_key", "That photo does not belong to this item.");
  }
  const res = await (await db()).query<{ image_key: string }>(
    `UPDATE store.items SET image_key = $2, updated_at = NOW() WHERE id = $1 AND kind = 'merch' RETURNING image_key`,
    [itemId, objectKey],
  );
  if (!res.rows[0]) throw new NowError(404, "not_found", "Merch item not found.");
  return { imageUrl: storeImageUrl(res.rows[0].image_key) };
}

// ---------------------------------------------------------------------------
// Nightly.

/** Wipes delivery addresses 90 days after delivery or cancellation. */
export async function purgeOldDeliveryAddresses(now: Date = new Date()): Promise<number> {
  const before = new Date(now.getTime() - ADDRESS_KEEP_DAYS * 24 * 60 * 60_000);
  const res = await (await db()).query(
    `UPDATE store.orders SET delivery = NULL, address_purged_at = $2
      WHERE delivery IS NOT NULL AND (delivered_at <= $1 OR cancelled_at <= $1)`,
    [before, now],
  );
  return res.rowCount ?? 0;
}

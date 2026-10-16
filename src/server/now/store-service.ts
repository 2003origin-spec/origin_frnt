/**
 * Origin Store pilot (build step 9; plan doc "Origin Store"): the only place
 * Ori Coins leave the system. Pilot items:
 *
 * - premium: N days of a subject's premium, granted as an
 *   `entitlements.subject_grants` row with source `coin_redemption` and an
 *   expiry. The entitlement read path already counts every active grant.
 * - digital: a PDF paper in the private bucket, downloaded through a
 *   10-minute signed link by whoever bought it.
 *
 * Coins only (rupee and mixed prices come after the pilot). A purchase is one
 * transaction: order row, coin debit (`store_spend` → platform:store), stock,
 * and the grant. Purchased items are not refundable in coins.
 */

import { randomBytes } from "node:crypto";

import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import { createPresignedR2PutUrl } from "@/server/media-storage";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { createPrefixedId, createSubjectGrantId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { logEvent } from "./dispatch-service";
import { storeSpend } from "./ledger-rules";
import { getWalletBalance, postTransfers, withNowTransaction } from "./ledger-store";
import { getNowAccess } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { ensureWelcomeGrant } from "./wallet-service";
import {
  DOWNLOAD_LINK_SECONDS,
  isPaperUpload,
  paperObjectKey,
  premiumWindow,
  validateStoreItem,
  type StoreItemInput,
} from "./store-rules";

declare global {
  var __originCoinRedemptionSourceEnsured: boolean | undefined;
}

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Runtime mirror of 20261017_origin_now_coin_redemption_grant.sql (guarded: no DDL when already right). */
export async function ensureCoinRedemptionGrantSource(): Promise<void> {
  if (globalThis.__originCoinRedemptionSourceEnsured) return;
  await ensureSubjectGrantsSchema();
  const client = await (await db()).connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
    await client.query(`
      DO $$
      DECLARE constraint_def TEXT;
      BEGIN
        SELECT pg_get_constraintdef(oid) INTO constraint_def
          FROM pg_constraint
         WHERE conrelid = 'entitlements.subject_grants'::regclass
           AND conname = 'subject_grants_source_check';
        IF constraint_def IS NULL OR position('coin_redemption' IN constraint_def) = 0 THEN
          ALTER TABLE entitlements.subject_grants DROP CONSTRAINT IF EXISTS subject_grants_source_check;
          ALTER TABLE entitlements.subject_grants
            ADD CONSTRAINT subject_grants_source_check
            CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order', 'coin_redemption'));
        END IF;
      END $$;`);
    await client.query(
      `INSERT INTO app.migrations (id, name) VALUES ('20261017_origin_now_coin_redemption_grant', 'origin now coin_redemption grant source')
       ON CONFLICT (id) DO NOTHING`,
    );
    await client.query("COMMIT");
    globalThis.__originCoinRedemptionSourceEnsured = true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type ItemRow = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  price_coins: number;
  price_paise: number;
  stock: number | null;
  premium_subject: string | null;
  premium_days: number | null;
  file_key: string | null;
  featured: boolean;
  active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type StoreItemView = {
  id: string;
  kind: "premium" | "digital";
  title: string;
  description: string | null;
  priceCoins: number;
  inStock: boolean;
  premiumSubject: string | null;
  premiumDays: number | null;
  featured: boolean;
  /** Digital: this user already owns it (download from My orders). */
  owned: boolean;
  /** Premium: this user's coin premium for the subject currently runs until this time. */
  coinPremiumUntil: string | null;
};

async function assertStoreAccess(userId: string) {
  const access = await getNowAccess(userId);
  if (!access.enabled) throw new NowError(404, "not_found", "Not found.");
  if (!access.inCohort && !access.helper) {
    throw new NowError(403, "not_invited", "The Origin Store is open to Origin NOW pilot members.");
  }
  return access;
}

async function latestCoinPremium(userId: string): Promise<Map<string, Date>> {
  await ensureCoinRedemptionGrantSource();
  const res = await (await db()).query<{ subject: string; until: Date }>(
    `SELECT subject, max(expires_at) AS until FROM entitlements.subject_grants
      WHERE user_id = $1 AND source = 'coin_redemption' AND status = 'active' AND expires_at > NOW()
      GROUP BY subject`,
    [userId],
  );
  return new Map(res.rows.map((r) => [r.subject, r.until]));
}

export async function listStoreItems(userId: string): Promise<{ items: StoreItemView[]; balance: number }> {
  const access = await assertStoreAccess(userId);
  // Same rule as the wallet screen: a pilot student's first visit grants the welcome coins.
  if (access.canRequest) await ensureWelcomeGrant(userId);
  const pool = await db();
  const [items, owned, premium, balance] = await Promise.all([
    pool.query<ItemRow>(
      `SELECT * FROM store.items WHERE active AND kind IN ('premium', 'digital') AND price_paise = 0
        ORDER BY featured DESC, kind, price_coins, title`,
    ),
    pool.query<{ item_id: string }>(
      `SELECT DISTINCT o.item_id FROM store.orders o JOIN store.items i ON i.id = o.item_id
        WHERE o.user_id = $1 AND o.status = 'fulfilled' AND i.kind = 'digital'`,
      [userId],
    ),
    latestCoinPremium(userId),
    getWalletBalance(userId),
  ]);
  const ownedIds = new Set(owned.rows.map((r) => r.item_id));
  return {
    balance: balance.available,
    items: items.rows.map((r) => ({
      id: r.id,
      kind: r.kind as "premium" | "digital",
      title: r.title,
      description: r.description,
      priceCoins: r.price_coins,
      inStock: r.stock === null || r.stock > 0,
      premiumSubject: r.premium_subject,
      premiumDays: r.premium_days,
      featured: r.featured,
      owned: ownedIds.has(r.id),
      coinPremiumUntil: r.premium_subject ? (premium.get(r.premium_subject)?.toISOString() ?? null) : null,
    })),
  };
}

export type StoreOrderView = {
  id: string;
  itemId: string;
  title: string;
  kind: string;
  coinsSpent: number;
  status: string;
  premiumSubject: string | null;
  premiumExpiresAt: string | null;
  canDownload: boolean;
  createdAt: string;
};

type OrderJoinRow = {
  id: string;
  item_id: string;
  title: string;
  kind: string;
  coins_spent: number;
  status: string;
  premium_subject: string | null;
  premium_expires_at: Date | null;
  file_key: string | null;
  created_at: Date;
};

function orderView(r: OrderJoinRow): StoreOrderView {
  return {
    id: r.id,
    itemId: r.item_id,
    title: r.title,
    kind: r.kind,
    coinsSpent: r.coins_spent,
    status: r.status,
    premiumSubject: r.premium_subject,
    premiumExpiresAt: r.premium_expires_at ? r.premium_expires_at.toISOString() : null,
    canDownload: r.kind === "digital" && r.status === "fulfilled" && Boolean(r.file_key),
    createdAt: r.created_at.toISOString(),
  };
}

const ORDER_SELECT = `SELECT o.id, o.item_id, i.title, i.kind, o.coins_spent, o.status, i.premium_subject,
                             o.premium_expires_at, i.file_key, o.created_at
                        FROM store.orders o JOIN store.items i ON i.id = o.item_id`;

export async function listMyOrders(userId: string): Promise<StoreOrderView[]> {
  const res = await (await db()).query<OrderJoinRow>(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 100`, [userId]);
  return res.rows.map(orderView);
}

async function getOrder(orderId: string): Promise<StoreOrderView | null> {
  const res = await (await db()).query<OrderJoinRow>(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  return res.rows[0] ? orderView(res.rows[0]) : null;
}

/** Buys one item with coins. Safe to retry with the same Idempotency-Key. */
export async function buyStoreItem(
  userId: string,
  itemId: string,
  idempotencyKey: string,
  now: Date = new Date(),
): Promise<{ order: StoreOrderView; alreadyOwned: boolean }> {
  await assertStoreAccess(userId);
  await ensureCoinRedemptionGrantSource();
  let orderId = "";
  let alreadyOwned = false;
  let premiumGranted = false;

  await withNowTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM store.orders WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey],
    );
    if (existing.rows[0]) {
      orderId = existing.rows[0].id;
      return;
    }
    const itemRes = await client.query<ItemRow>(`SELECT * FROM store.items WHERE id = $1 FOR UPDATE`, [itemId]);
    const item = itemRes.rows[0];
    if (!item || !item.active || !["premium", "digital"].includes(item.kind) || item.price_paise !== 0) {
      throw new NowError(404, "not_on_sale", "That item is not on sale.");
    }
    if (item.kind === "digital") {
      if (!item.file_key) throw new NowError(409, "not_ready", "That paper is not ready yet.");
      const owned = await client.query<{ id: string }>(
        `SELECT id FROM store.orders WHERE user_id = $1 AND item_id = $2 AND status = 'fulfilled' LIMIT 1`,
        [userId, itemId],
      );
      if (owned.rows[0]) {
        orderId = owned.rows[0].id;
        alreadyOwned = true;
        return;
      }
    }
    // After the ownership check: an owner tapping Buy again hears "you own it", not "sold out".
    if (item.stock !== null && item.stock <= 0) throw new NowError(409, "sold_out", "That item is sold out.");

    orderId = createPrefixedId("sord");
    await client.query(
      `INSERT INTO store.orders (id, user_id, item_id, coins_spent, paise_paid, status, idempotency_key, created_at)
       VALUES ($1, $2, $3, $4, 0, 'placed', $5, $6)`,
      [orderId, userId, itemId, item.price_coins, idempotencyKey, now],
    );
    // Throws InsufficientCoinsError / FrozenAccountError and rolls everything back.
    await postTransfers([storeSpend(userId, item.price_coins, orderId)], { client, now });
    if (item.stock !== null) await client.query(`UPDATE store.items SET stock = stock - 1, updated_at = NOW() WHERE id = $1`, [itemId]);

    let grantId: string | null = null;
    let premiumEnd: Date | null = null;
    if (item.kind === "premium") {
      // Same per-user lock the paid-grant writer uses, so stacking cannot race.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
      const latest = await client.query<{ until: Date | null }>(
        `SELECT max(expires_at) AS until FROM entitlements.subject_grants
          WHERE user_id = $1 AND subject = $2 AND source = 'coin_redemption' AND status = 'active'`,
        [userId, item.premium_subject],
      );
      const window = premiumWindow(latest.rows[0]?.until ?? null, item.premium_days ?? 0, now);
      grantId = createSubjectGrantId();
      premiumEnd = window.end;
      await client.query(
        `INSERT INTO entitlements.subject_grants (id, user_id, subject, source, status, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, 'coin_redemption', 'active', $4, $5, $5)`,
        [grantId, userId, item.premium_subject, window.end, now],
      );
      premiumGranted = true;
    }
    await client.query(
      `UPDATE store.orders SET status = 'fulfilled', fulfilled_at = $2, grant_id = $3, premium_expires_at = $4 WHERE id = $1`,
      [orderId, now, grantId, premiumEnd],
    );
    await logEvent(client, {
      type: "store.purchased",
      actor: userId,
      payload: { orderId, itemId, kind: item.kind, coins: item.price_coins, premiumSubject: item.premium_subject, premiumEnd },
    });
  }).catch(async (error) => {
    // Two taps with the same key at once: the second loses the unique index and
    // gets the first one's order instead of an error (nothing is charged twice).
    if ((error as { code?: string }).code !== "23505") throw error;
    const winner = await (await db()).query<{ id: string }>(
      `SELECT id FROM store.orders WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey],
    );
    if (!winner.rows[0]) throw error;
    orderId = winner.rows[0].id;
    premiumGranted = false;
  });

  // The denormalised is_premium / premium_expiry mirror follows the grants.
  if (premiumGranted) await recomputeUserPremiumFlags(userId);
  const order = await getOrder(orderId);
  if (!order) throw new Error("Store order vanished after commit.");
  return { order, alreadyOwned };
}

/** A 10-minute link to a bought paper; every link is logged. */
export async function getPaperDownload(userId: string, orderId: string) {
  const pool = await db();
  const res = await pool.query<OrderJoinRow & { user_id: string }>(`${ORDER_SELECT.replace("SELECT o.id", "SELECT o.user_id, o.id")} WHERE o.id = $1`, [orderId]);
  const row = res.rows[0];
  if (!row || row.user_id !== userId) throw new NowError(404, "not_found", "Order not found.");
  if (row.kind !== "digital" || row.status !== "fulfilled" || !row.file_key) {
    throw new NowError(409, "no_download", "There is nothing to download for this order.");
  }
  const signed = createPresignedR2PutUrl({ objectKey: row.file_key, method: "GET", expiresSeconds: DOWNLOAD_LINK_SECONDS });
  await pool.query(`UPDATE store.orders SET downloads = downloads + 1 WHERE id = $1`, [orderId]);
  await logEvent(pool, { type: "store.download", actor: userId, payload: { orderId, itemId: row.item_id } });
  return { url: signed.url, expiresInSeconds: DOWNLOAD_LINK_SECONDS };
}

// ---------------------------------------------------------------------------
// Admin.

export type AdminStoreItem = ItemRow & { orders: number };

export async function listStoreItemsForAdmin(): Promise<AdminStoreItem[]> {
  const res = await (await db()).query<AdminStoreItem>(
    `SELECT i.*, (SELECT count(*)::int FROM store.orders o WHERE o.item_id = i.id AND o.status = 'fulfilled') AS orders
       FROM store.items i ORDER BY i.active DESC, i.created_at DESC`,
  );
  return res.rows;
}

export async function upsertStoreItem(input: StoreItemInput & { id?: string }): Promise<ItemRow> {
  const pool = await db();
  const current = input.id
    ? (await pool.query<ItemRow>(`SELECT * FROM store.items WHERE id = $1`, [input.id])).rows[0]
    : undefined;
  if (input.id && !current) throw new NowError(404, "not_found", "Item not found.");
  if (current && current.kind !== input.kind) throw new NowError(400, "kind_locked", "An item's kind cannot change; make a new item.");
  // A new paper has no file yet, so it is saved switched off; switching it on is checked once it exists.
  const startsOff = input.kind === "digital" && !current;
  const errors = validateStoreItem({ ...input, active: startsOff ? false : input.active, hasFile: Boolean(current?.file_key) });
  if (errors.length) throw new NowError(400, "invalid_item", errors.join(" "));
  const id = input.id ?? createPrefixedId("sitem");
  const res = await pool.query<ItemRow>(
    `INSERT INTO store.items (id, kind, title, description, price_coins, price_paise, stock, premium_subject, premium_days, featured, active)
     VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
       price_coins = EXCLUDED.price_coins, stock = EXCLUDED.stock, premium_subject = EXCLUDED.premium_subject,
       premium_days = EXCLUDED.premium_days, featured = EXCLUDED.featured, active = EXCLUDED.active, updated_at = NOW()
     RETURNING *`,
    [
      id,
      input.kind,
      input.title.trim(),
      input.description?.trim() || null,
      input.priceCoins,
      input.stock ?? null,
      input.kind === "premium" ? input.premiumSubject : null,
      input.kind === "premium" ? input.premiumDays : null,
      Boolean(input.featured),
      // A new digital item starts switched off until its file is uploaded.
      input.kind === "digital" && !current?.file_key ? false : input.active !== false,
    ],
  );
  return res.rows[0];
}

export async function createPaperUpload(itemId: string, input: { mimeType: string; sizeBytes: number }) {
  const pool = await db();
  const item = (await pool.query<ItemRow>(`SELECT * FROM store.items WHERE id = $1`, [itemId])).rows[0];
  if (!item || item.kind !== "digital") throw new NowError(404, "not_found", "Digital item not found.");
  if (!isPaperUpload(input.mimeType, input.sizeBytes)) throw new NowError(400, "invalid_file", "Upload a PDF of 50 MB or less.");
  const objectKey = paperObjectKey(itemId, randomBytes(8).toString("hex"));
  const signed = createPresignedR2PutUrl({ objectKey, method: "PUT", expiresSeconds: 900 });
  return { uploadUrl: signed.url, objectKey, method: "PUT", contentType: "application/pdf" };
}

export async function confirmPaperUpload(itemId: string, objectKey: string) {
  if (!objectKey.startsWith(`origin-now/store/${itemId}/`) || !objectKey.endsWith(".pdf")) {
    throw new NowError(400, "invalid_key", "That file does not belong to this item.");
  }
  const res = await (await db()).query<ItemRow>(
    `UPDATE store.items SET file_key = $2, updated_at = NOW() WHERE id = $1 AND kind = 'digital' RETURNING *`,
    [itemId, objectKey],
  );
  if (!res.rows[0]) throw new NowError(404, "not_found", "Digital item not found.");
  return res.rows[0];
}

export async function listStoreOrdersForAdmin(limit = 200) {
  const res = await (await db()).query(
    `SELECT o.*, i.title, i.kind FROM store.orders o JOIN store.items i ON i.id = o.item_id ORDER BY o.created_at DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return res.rows;
}

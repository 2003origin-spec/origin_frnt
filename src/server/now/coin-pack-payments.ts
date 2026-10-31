/**
 * Glue between Ori Coins packs and the existing Razorpay one-time-order rail
 * (V1/RAZORPAY_PAYMENTS_PLAN.md). A coin pack is a `payments.orders` row of
 * kind `coin_pack`; its coins are frozen into the order notes at checkout and
 * credited inside `applyPaymentSuccess`'s own transaction, so a captured
 * payment and its coins commit together or not at all.
 *
 * Refunds: purchased coins are non-refundable once credited, but a refund can
 * still arrive from Razorpay (duplicate payment, dispute, dashboard action).
 * The coins still spendable are taken back; if some were already spent, the
 * wallet is frozen and an event is logged for admin review — the refund
 * webhook itself never fails, because Razorpay has already moved the money.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { computeWalletBalance, packPurchase, packRefund, promoBonus, userAccount } from "./ledger-rules";
import { postTransfers } from "./ledger-store";
import { ensureNowSchema } from "./now-schema";
import { bestPackBonus, type PromotionRow } from "./promotions";
import { withSchemaLock } from "@/server/schema-lock";

/** Adds `coin_pack` to payments.order_kind. Must run outside any transaction that uses it. */
export async function ensureCoinPackOrderKind(): Promise<void> {
  const pool = getUserPostgresPool();
  if (!pool) return;
  if (globalThis.__originCoinPackKindEnsured) return;
  // Its own short transaction (PG12+ allows ADD VALUE in one); the value is
  // usable by every transaction that starts after this commits.
  await withSchemaLock(pool, (client) =>
    client.query(`ALTER TYPE payments.order_kind ADD VALUE IF NOT EXISTS 'coin_pack'`),
  );
  globalThis.__originCoinPackKindEnsured = true;
}

declare global {
  var __originCoinPackKindEnsured: boolean | undefined;
}

export type ResolvedCoinPack = {
  packId: string;
  packName: string;
  coins: number;
  amountMinor: number;
  bonusCoins: number;
  bonusPromotionId: string | null;
  bonusExpiresAt: string | null;
};

/** Prices a coin pack from the database; the request never supplies an amount. */
export async function resolveCoinPack(input: { packId: string; userId: string; now: Date }): Promise<ResolvedCoinPack> {
  await ensureNowSchema();
  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");
  const pack = await pool.query<{ id: string; name: string; coins: number; price_paise: number }>(
    `SELECT id, name, coins, price_paise FROM now.coin_packs WHERE id = $1 AND active`,
    [input.packId],
  );
  const row = pack.rows[0];
  if (!row) throw Object.assign(new Error("That coin pack is not on sale."), { status: 404 });
  const [promos, cohort] = await Promise.all([
    pool.query<{
      id: string;
      kind: "percent_on_pack" | "flat_grant";
      value: number;
      audience: "all" | "cohort" | "pack_buyers";
      pack_id: string | null;
      starts_at: Date;
      ends_at: Date;
      bonus_expires_after_days: number | null;
      active: boolean;
    }>(`SELECT * FROM now.promotions WHERE active AND kind = 'percent_on_pack' AND starts_at <= $1 AND ends_at > $1`, [
      input.now,
    ]),
    pool.query(`SELECT 1 FROM now.pilot_cohort WHERE user_id = $1 AND removed_at IS NULL`, [input.userId]),
  ]);
  const promotions: PromotionRow[] = promos.rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    value: p.value,
    audience: p.audience,
    packId: p.pack_id,
    startsAt: p.starts_at,
    endsAt: p.ends_at,
    bonusExpiresAfterDays: p.bonus_expires_after_days,
    active: p.active,
  }));
  const bonus = bestPackBonus({
    promotions,
    packId: row.id,
    packCoins: row.coins,
    inCohort: (cohort.rowCount ?? 0) > 0,
    now: input.now,
  });
  return {
    packId: row.id,
    packName: row.name,
    coins: row.coins,
    amountMinor: row.price_paise,
    bonusCoins: bonus?.coins ?? 0,
    bonusPromotionId: bonus?.promotionId ?? null,
    bonusExpiresAt: bonus?.expiresAt ? bonus.expiresAt.toISOString() : null,
  };
}

/** Order notes written at checkout; read back at capture. */
export function coinPackNotes(pack: ResolvedCoinPack): Record<string, string | number> {
  return {
    origin_pack_id: pack.packId,
    pack_name: pack.packName,
    pack_coins: pack.coins,
    bonus_coins: pack.bonusCoins,
    ...(pack.bonusPromotionId ? { bonus_promotion_id: pack.bonusPromotionId } : {}),
    ...(pack.bonusExpiresAt ? { bonus_expires_at: pack.bonusExpiresAt } : {}),
  };
}

function noteNumber(notes: Record<string, unknown>, key: string): number {
  const value = Number(notes[key]);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * Credits the coins for a captured coin-pack order, inside the caller's
 * payment transaction. Idempotent on the order id.
 */
export async function creditCoinPackOrder(
  client: PoolClient,
  order: { id: string; userId: string; notes: Record<string, unknown> },
): Promise<number> {
  const coins = noteNumber(order.notes, "pack_coins");
  if (coins === 0) throw new Error("Coin pack order is missing its coin amount");
  const bonus = noteNumber(order.notes, "bonus_coins");
  const promotionId = typeof order.notes.bonus_promotion_id === "string" ? order.notes.bonus_promotion_id : null;
  const expiresAt =
    typeof order.notes.bonus_expires_at === "string" ? new Date(order.notes.bonus_expires_at) : null;
  const transfers = [packPurchase(order.userId, coins, order.id)];
  if (bonus > 0) {
    // Keyed on the order, not the promotion, so a student can use a promotion
    // on every pack they buy while each order's bonus is still paid once.
    transfers.push(promoBonus(order.userId, bonus, `${promotionId ?? "pack"}:${order.id}`, expiresAt));
  }
  await postTransfers(transfers, { client, note: `coin pack order ${order.id}` });
  return coins + bonus;
}

/**
 * On a full refund of a coin-pack order: take back what is still spendable,
 * freeze the wallet if anything was already spent, and log it.
 */
export async function reverseCoinPackOnRefund(
  client: PoolClient,
  order: { id: string; userId: string; notes: Record<string, unknown> },
): Promise<{ reversed: number; shortfall: number }> {
  const credited = noteNumber(order.notes, "pack_coins") + noteNumber(order.notes, "bonus_coins");
  if (credited === 0) return { reversed: 0, shortfall: 0 };
  const account = userAccount(order.userId);
  await client.query(
    `INSERT INTO now.accounts (id, owner_type, owner_id) VALUES ($1, 'user', $2) ON CONFLICT (id) DO NOTHING`,
    [account, order.userId],
  );
  await client.query(`SELECT 1 FROM now.accounts WHERE id = $1 FOR UPDATE`, [account]);
  const legs = await client.query<{
    direction: "debit" | "credit";
    amount: number;
    kind: string;
    created_at: Date;
    available_at: Date | null;
    expires_at: Date | null;
  }>(
    `SELECT direction, amount, kind, created_at, available_at, expires_at
       FROM now.ledger_entries WHERE account_id = $1 ORDER BY created_at, id`,
    [account],
  );
  const balance = computeWalletBalance(
    legs.rows.map((r) => ({
      direction: r.direction,
      amount: r.amount,
      kind: r.kind as never,
      createdAt: r.created_at,
      availableAt: r.available_at,
      expiresAt: r.expires_at,
    })),
    new Date(),
  );
  const reversed = Math.max(0, Math.min(credited, balance.available));
  const shortfall = credited - reversed;
  if (reversed > 0) await postTransfers([packRefund(order.userId, reversed, order.id)], { client });
  if (shortfall > 0) {
    await client.query(`UPDATE now.accounts SET frozen = TRUE WHERE id = $1`, [account]);
    await client.query(
      `INSERT INTO now.events (type, actor, payload) VALUES ('wallet.refund_shortfall', 'system', $1::jsonb)`,
      [JSON.stringify({ orderId: order.id, userId: order.userId, credited, reversed, shortfall })],
    );
  }
  return { reversed, shortfall };
}

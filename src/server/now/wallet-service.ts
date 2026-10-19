/**
 * Ori Coins wallet: welcome grant, balance + history, coin packs catalogue,
 * admin adjustments (plan doc, "Ori Coins wallet").
 *
 * The welcome grant is once per person: `now.welcome_grants` is keyed by user
 * id and the ledger transfer has a fixed idempotency key, so a double click, a
 * retry or two tabs all end in exactly one grant.
 */

import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { adminCredit, welcomeGrant, type WalletBalance } from "./ledger-rules";
import { getWalletBalance, listWalletMovements, postTransfers, withNowTransaction, type WalletMovement } from "./ledger-store";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * Grants the welcome coins if this user has never had them. Returns the coins
 * granted now (0 when already granted or the setting is 0).
 */
export async function ensureWelcomeGrant(userId: string): Promise<number> {
  const { welcomeCoins } = await getNowSettings();
  return withNowTransaction(async (client) => {
    const claimed = await client.query(
      `INSERT INTO now.welcome_grants (user_id, coins) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, welcomeCoins],
    );
    if (claimed.rowCount === 0 || welcomeCoins <= 0) return 0;
    await postTransfers([welcomeGrant(userId, welcomeCoins)], { client });
    await client.query(
      `UPDATE now.welcome_grants
          SET transfer_id = (SELECT id FROM now.ledger_transfers WHERE idempotency_key = $2)
        WHERE user_id = $1`,
      [userId, `welcome:${userId}`],
    );
    return welcomeCoins;
  });
}

export type CoinPack = { id: string; name: string; coins: number; pricePaise: number; active: boolean; sortOrder: number };

type PackRow = { id: string; name: string; coins: number; price_paise: number; active: boolean; sort_order: number };

function toPack(row: PackRow): CoinPack {
  return {
    id: row.id,
    name: row.name,
    coins: row.coins,
    pricePaise: row.price_paise,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export async function listCoinPacks(options: { includeInactive?: boolean } = {}): Promise<CoinPack[]> {
  await ensureNowSchema();
  const res = await pool().query<PackRow>(
    `SELECT id, name, coins, price_paise, active, sort_order FROM now.coin_packs
      ${options.includeInactive ? "" : "WHERE active"}
      ORDER BY sort_order, price_paise`,
  );
  return res.rows.map(toPack);
}

export function validateCoinPack(input: Partial<CoinPack>): string[] {
  const errors: string[] = [];
  if (!input.name || input.name.trim().length < 2 || input.name.trim().length > 60) errors.push("Name must be 2 to 60 characters.");
  if (!Number.isInteger(input.coins) || (input.coins as number) <= 0) errors.push("Coins must be a whole number above 0.");
  if (!Number.isInteger(input.pricePaise) || (input.pricePaise as number) < 100) errors.push("Price must be at least Rs 1 (100 paise).");
  return errors;
}

export async function upsertCoinPack(input: Partial<CoinPack> & { id?: string }): Promise<CoinPack> {
  const errors = validateCoinPack(input);
  if (errors.length) throw new Error(errors.join(" "));
  await ensureNowSchema();
  const id = input.id ?? createPrefixedId("pack");
  const res = await pool().query<PackRow>(
    `INSERT INTO now.coin_packs (id, name, coins, price_paise, active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, coins = EXCLUDED.coins,
       price_paise = EXCLUDED.price_paise, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING id, name, coins, price_paise, active, sort_order`,
    [id, input.name!.trim(), input.coins, input.pricePaise, input.active ?? true, input.sortOrder ?? 0],
  );
  return toPack(res.rows[0]);
}

export type WalletSummary = {
  balance: WalletBalance;
  movements: WalletMovement[];
  packs: CoinPack[];
  welcomeGranted: number;
};

export async function getWalletSummary(userId: string, options: { grantWelcome: boolean }): Promise<WalletSummary> {
  const welcomeGranted = options.grantWelcome ? await ensureWelcomeGrant(userId) : 0;
  const [balance, movements, packs] = await Promise.all([
    getWalletBalance(userId),
    listWalletMovements(userId, 30),
    listCoinPacks(),
  ]);
  return { balance, movements, packs, welcomeGranted };
}

/** Admin correction: always a credit from Origin's account, never a debit. */
export async function adminAdjustWallet(input: {
  userId: string;
  coins: number;
  reason: string;
  adminId: string;
}): Promise<void> {
  if (!Number.isInteger(input.coins) || input.coins <= 0) throw new Error("Adjustment must be a positive whole number of coins.");
  if (!input.reason || input.reason.trim().length < 5) throw new Error("A reason of at least 5 characters is required.");
  await postTransfers([adminCredit(input.userId, input.coins, createPrefixedId("adj"))], {
    actorId: input.adminId,
    note: input.reason.trim(),
  });
}

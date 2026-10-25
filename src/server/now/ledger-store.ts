/**
 * Ori Coins ledger persistence (plan doc, "Coin ledger invariants").
 *
 * Writes go through `postTransfers`, which in ONE transaction:
 *   1. locks every user account it will debit (row lock on now.accounts, taken
 *      in sorted order so two concurrent spends cannot deadlock),
 *   2. skips any transfer whose idempotency key already exists (a retried
 *      request is a no-op, never a double charge),
 *   3. refuses a user debit that would take the spendable balance below zero
 *      or that comes from a frozen account,
 *   4. writes one transfer row and exactly two legs (debit + credit).
 *
 * The arithmetic (balances, pending, promo expiry) lives in ledger-rules.ts.
 */

import type { PoolClient } from "pg";

import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import {
  assertValidTransfer,
  computeWalletBalance,
  isUserAccount,
  userAccount,
  type LedgerLeg,
  type Transfer,
  type TransferKind,
  type WalletBalance,
} from "./ledger-rules";
import { ensureNowSchema } from "./now-schema";

export class InsufficientCoinsError extends Error {
  readonly available: number;
  readonly needed: number;
  constructor(available: number, needed: number) {
    super(`Not enough coins: ${available} available, ${needed} needed.`);
    this.available = available;
    this.needed = needed;
  }
}

export class FrozenAccountError extends Error {
  constructor(account: string) {
    super(`Coin account ${account} is frozen.`);
  }
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Runs `fn` inside a transaction on the user pool (schema ensured first). */
export async function withNowTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureNowSchema();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

function accountOwner(account: string): { ownerType: "user" | "platform"; ownerId: string } {
  const [type, ...rest] = account.split(":");
  return { ownerType: type === "user" ? "user" : "platform", ownerId: rest.join(":") };
}

async function ensureAccounts(client: PoolClient, accounts: readonly string[]): Promise<void> {
  for (const account of accounts) {
    const { ownerType, ownerId } = accountOwner(account);
    await client.query(
      `INSERT INTO now.accounts (id, owner_type, owner_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [account, ownerType, ownerId],
    );
  }
}

type LegRow = {
  direction: "debit" | "credit";
  amount: number;
  kind: TransferKind;
  created_at: Date;
  available_at: Date | null;
  expires_at: Date | null;
};

export async function loadLegs(client: Pick<PoolClient, "query">, account: string): Promise<LedgerLeg[]> {
  const res = await client.query<LegRow>(
    `SELECT direction, amount, kind, created_at, available_at, expires_at
       FROM now.ledger_entries WHERE account_id = $1 ORDER BY created_at, id`,
    [account],
  );
  return res.rows.map((row) => ({
    direction: row.direction,
    amount: row.amount,
    kind: row.kind,
    createdAt: row.created_at,
    availableAt: row.available_at,
    expiresAt: row.expires_at,
  }));
}

export type PostResult = { posted: string[]; skipped: string[] };

/**
 * Posts a group of transfers atomically. Caller may pass its own client to
 * join a larger transaction (e.g. a request insert + its coin hold).
 */
export async function postTransfers(
  transfers: readonly Transfer[],
  options: { client?: PoolClient; actorId?: string | null; note?: string | null; now?: Date } = {},
): Promise<PostResult> {
  if (transfers.length === 0) return { posted: [], skipped: [] };
  for (const t of transfers) assertValidTransfer(t);
  const run = async (client: PoolClient): Promise<PostResult> => {
    const now = options.now ?? new Date();
    const accounts = [...new Set(transfers.flatMap((t) => [t.from, t.to]))].sort();
    await ensureAccounts(client, accounts);

    const debitedUsers = [...new Set(transfers.filter((t) => isUserAccount(t.from)).map((t) => t.from))].sort();
    const locked = debitedUsers.length
      ? await client.query<{ id: string; frozen: boolean }>(
          `SELECT id, frozen FROM now.accounts WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
          [debitedUsers],
        )
      : { rows: [] as { id: string; frozen: boolean }[] };
    const frozen = new Set(locked.rows.filter((r) => r.frozen).map((r) => r.id));

    const existing = await client.query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM now.ledger_transfers WHERE idempotency_key = ANY($1::text[])`,
      [transfers.map((t) => t.idempotencyKey)],
    );
    const already = new Set(existing.rows.map((r) => r.idempotency_key));
    const fresh = transfers.filter((t) => !already.has(t.idempotencyKey));

    // Spendable check per debited user, against everything this batch takes.
    const needByAccount = new Map<string, number>();
    for (const t of fresh) {
      if (isUserAccount(t.from)) needByAccount.set(t.from, (needByAccount.get(t.from) ?? 0) + t.amount);
    }
    for (const [account, needed] of needByAccount) {
      if (frozen.has(account)) throw new FrozenAccountError(account);
      const balance = computeWalletBalance(await loadLegs(client, account), now);
      if (balance.available < needed) throw new InsufficientCoinsError(balance.available, needed);
    }

    const posted: string[] = [];
    for (const t of fresh) {
      const transferId = createPrefixedId("ctx");
      const inserted = await client.query(
        `INSERT INTO now.ledger_transfers (id, kind, idempotency_key, amount, request_id, order_ref, note, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [
          transferId,
          t.kind,
          t.idempotencyKey,
          t.amount,
          t.requestId ?? null,
          t.orderRef ?? null,
          options.note ?? null,
          options.actorId ?? null,
          now,
        ],
      );
      if (inserted.rowCount === 0) continue;
      await client.query(
        `INSERT INTO now.ledger_entries (transfer_id, account_id, direction, amount, kind, available_at, expires_at, created_at)
         VALUES ($1, $2, 'debit', $3, $4, NULL, NULL, $7),
                ($1, $5, 'credit', $3, $4, $6, $8, $7)`,
        [transferId, t.from, t.amount, t.kind, t.to, t.availableAt ?? null, now, t.expiresAt ?? null],
      );
      posted.push(t.idempotencyKey);
    }
    return { posted, skipped: [...already] };
  };
  if (options.client) return run(options.client);
  return withNowTransaction(run);
}

export async function getWalletBalance(userId: string, now: Date = new Date()): Promise<WalletBalance> {
  await ensureNowSchema();
  return computeWalletBalance(await loadLegs(pool(), userAccount(userId)), now);
}

export type WalletMovement = {
  transferId: string;
  kind: TransferKind;
  direction: "debit" | "credit";
  amount: number;
  createdAt: string;
  availableAt: string | null;
  expiresAt: string | null;
  requestId: string | null;
};

export async function listWalletMovements(userId: string, limit = 50): Promise<WalletMovement[]> {
  await ensureNowSchema();
  const res = await pool().query<{
    transfer_id: string;
    kind: TransferKind;
    direction: "debit" | "credit";
    amount: number;
    created_at: Date;
    available_at: Date | null;
    expires_at: Date | null;
    request_id: string | null;
  }>(
    `SELECT e.transfer_id, e.kind, e.direction, e.amount, e.created_at, e.available_at, e.expires_at, t.request_id
       FROM now.ledger_entries e
       JOIN now.ledger_transfers t ON t.id = e.transfer_id
      WHERE e.account_id = $1
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $2`,
    [userAccount(userId), Math.min(Math.max(limit, 1), 200)],
  );
  return res.rows.map((row) => ({
    transferId: row.transfer_id,
    kind: row.kind,
    direction: row.direction,
    amount: row.amount,
    createdAt: row.created_at.toISOString(),
    availableAt: row.available_at ? row.available_at.toISOString() : null,
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    requestId: row.request_id,
  }));
}

export async function isWalletFrozen(userId: string): Promise<boolean> {
  await ensureNowSchema();
  const res = await pool().query<{ frozen: boolean }>(`SELECT frozen FROM now.accounts WHERE id = $1`, [userAccount(userId)]);
  return Boolean(res.rows[0]?.frozen);
}

export async function setAccountFrozen(userId: string, frozen: boolean): Promise<void> {
  await withNowTransaction(async (client) => {
    await ensureAccounts(client, [userAccount(userId)]);
    await client.query(`UPDATE now.accounts SET frozen = $2 WHERE id = $1`, [userAccount(userId), frozen]);
  });
}

/** Nightly invariant check input: every leg of every transfer. */
export async function loadAllLegsForAudit(): Promise<
  { transferId: string; direction: "debit" | "credit"; amount: number }[]
> {
  await ensureNowSchema();
  const res = await pool().query<{ transfer_id: string; direction: "debit" | "credit"; amount: number }>(
    `SELECT transfer_id, direction, amount FROM now.ledger_entries`,
  );
  return res.rows.map((r) => ({ transferId: r.transfer_id, direction: r.direction, amount: r.amount }));
}

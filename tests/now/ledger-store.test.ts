/**
 * postTransfers against a scripted client (no database): the frozen-wallet
 * rule and its one exemption, a coin-pack refund (plan rule B10).
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";

import { packRefund, storeSpend, userAccount } from "@/server/now/ledger-rules";
import { FrozenAccountError, lockWalletForSpend, postTransfers } from "@/server/now/ledger-store";

function frozenWalletClient(balance: number) {
  const inserts: string[] = [];
  const client = {
    async query(sql: string) {
      if (sql.includes("FROM now.accounts") && sql.includes("FOR UPDATE")) {
        return { rows: [{ id: userAccount("u1"), frozen: true }], rowCount: 1 };
      }
      if (sql.includes("SELECT idempotency_key")) return { rows: [], rowCount: 0 };
      if (sql.includes("FROM now.ledger_entries")) {
        return {
          rows: [
            {
              direction: "credit",
              amount: balance,
              kind: "pack_purchase",
              created_at: new Date("2026-10-01T00:00:00Z"),
              available_at: null,
              expires_at: null,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("INSERT INTO now.ledger_transfers")) inserts.push("transfer");
      if (sql.includes("INSERT INTO now.ledger_entries")) inserts.push("legs");
      return { rows: [], rowCount: 1 };
    },
  };
  return { client: client as unknown as PoolClient, inserts };
}

test("NOW-1: a coin-pack refund debits a frozen wallet instead of failing the webhook", async () => {
  const { client, inserts } = frozenWalletClient(100);
  const result = await postTransfers([packRefund("u1", 60, "order_1")], { client });
  assert.deepEqual(result.posted, ["pack_refund:order_1"]);
  assert.deepEqual(inserts, ["transfer", "legs"]);
});

test("NOW-1: every other debit from a frozen wallet is still refused", async () => {
  const { client, inserts } = frozenWalletClient(100);
  await assert.rejects(postTransfers([storeSpend("u1", 10, "store_1")], { client }), FrozenAccountError);
  // A refund in the same batch does not unlock the other debit.
  await assert.rejects(
    postTransfers([packRefund("u1", 10, "order_2"), storeSpend("u1", 10, "store_2")], { client }),
    FrozenAccountError,
  );
  assert.deepEqual(inserts, []);
});

test("NOW-4: the requeue balance check locks the wallet row and reads on the caller's transaction", async () => {
  const seen: string[] = [];
  const { client: inner } = frozenWalletClient(80);
  const client = {
    async query(sql: string, params?: unknown[]) {
      seen.push(sql.replace(/\s+/g, " ").trim());
      return (inner as unknown as { query: (s: string, p?: unknown[]) => Promise<unknown> }).query(sql, params);
    },
  } as unknown as PoolClient;
  const wallet = await lockWalletForSpend(client, "u1", new Date("2026-10-22T00:00:00Z"));
  assert.equal(wallet.balance.available, 80);
  assert.equal(wallet.frozen, true);
  const lockAt = seen.findIndex((q) => q.startsWith("SELECT frozen FROM now.accounts") && q.endsWith("FOR UPDATE"));
  const legsAt = seen.findIndex((q) => q.includes("FROM now.ledger_entries"));
  assert.ok(lockAt >= 0, "the wallet row is locked");
  assert.ok(legsAt > lockAt, "the balance is read after the lock, on the same client");
});

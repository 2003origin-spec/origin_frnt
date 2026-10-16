/**
 * Ori Coins ledger against a real Postgres: the welcome grant happens exactly
 * once even when called twice at the same moment, a hold can never overdraw a
 * wallet (including two simultaneous holds), retries are no-ops, and solver
 * earnings stay pending until the rating window closes.
 *
 * Skipped when USER_DATABASE_URL isn't configured (plain CI).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PLATFORM_ACCOUNTS, sessionCapture, sessionHold, sessionRelease, userAccount } from "@/server/now/ledger-rules";
import {
  FrozenAccountError,
  InsufficientCoinsError,
  getWalletBalance,
  loadAllLegsForAudit,
  postTransfers,
  setAccountFrozen,
} from "@/server/now/ledger-store";
import { findUnbalancedTransfers } from "@/server/now/ledger-rules";
import { ensureNowSchema } from "@/server/now/now-schema";
import { setSetting } from "@/server/platform-settings";
import { ensureWelcomeGrant } from "@/server/now/wallet-service";
import { RATING_WINDOW_MS } from "@/server/now/types";

import { closePool, dbConfigured, makeId, rawPool } from "./_db";

const SKIP = !dbConfigured();

async function seedUser(prefix: string): Promise<string> {
  const id = makeId(prefix);
  await rawPool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES ($1, 'Now Test', $2, 'student', 'test-no-login')`,
    [id, `${id}@example.com`],
  );
  return id;
}

async function removeUsers(ids: string[]): Promise<void> {
  const pool = rawPool();
  const accounts = ids.map(userAccount);
  await pool.query(`DELETE FROM now.welcome_grants WHERE user_id = ANY($1::text[])`, [ids]);
  await pool.query(
    `DELETE FROM now.ledger_entries WHERE transfer_id IN (
       SELECT transfer_id FROM now.ledger_entries WHERE account_id = ANY($1::text[]))`,
    [accounts],
  );
  await pool.query(
    `DELETE FROM now.ledger_transfers t WHERE NOT EXISTS (SELECT 1 FROM now.ledger_entries e WHERE e.transfer_id = t.id)`,
  );
  await pool.query(`DELETE FROM now.accounts WHERE id = ANY($1::text[])`, [accounts]);
  await pool.query(`DELETE FROM origin_users WHERE id = ANY($1::text[])`, [ids]);
}

test("welcome grant is paid exactly once, even under a race", { skip: SKIP }, async () => {
  await ensureNowSchema();
  await setSetting("now_welcome_coins", "200", null);
  const student = await seedUser("now_student");
  try {
    const results = await Promise.allSettled([ensureWelcomeGrant(student), ensureWelcomeGrant(student)]);
    const granted = results.map((r) => (r.status === "fulfilled" ? r.value : 0));
    assert.equal(granted.reduce((a, b) => a + b, 0), 200);
    assert.equal(await ensureWelcomeGrant(student), 0);
    assert.equal((await getWalletBalance(student)).available, 200);
  } finally {
    await removeUsers([student]);
  }
});

test("a hold cannot overdraw, and two simultaneous holds cannot both pass", { skip: SKIP }, async () => {
  await setSetting("now_welcome_coins", "200", null);
  const student = await seedUser("now_student");
  try {
    await ensureWelcomeGrant(student);
    await assert.rejects(postTransfers([sessionHold(student, makeId("req"), 250)]), InsufficientCoinsError);

    const results = await Promise.allSettled([
      postTransfers([sessionHold(student, makeId("req"), 150)]),
      postTransfers([sessionHold(student, makeId("req"), 150)]),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    assert.equal((await getWalletBalance(student)).available, 50);
  } finally {
    await removeUsers([student]);
  }
});

test("a retried hold is a no-op and a release returns the coins", { skip: SKIP }, async () => {
  await setSetting("now_welcome_coins", "200", null);
  const student = await seedUser("now_student");
  const requestId = makeId("req");
  try {
    await ensureWelcomeGrant(student);
    const first = await postTransfers([sessionHold(student, requestId, 60)]);
    const again = await postTransfers([sessionHold(student, requestId, 60)]);
    assert.equal(first.posted.length, 1);
    assert.equal(again.posted.length, 0);
    assert.equal((await getWalletBalance(student)).available, 140);
    await postTransfers(sessionRelease(student, requestId, 60));
    assert.equal((await getWalletBalance(student)).available, 200);
  } finally {
    await removeUsers([student]);
  }
});

test("solver earnings are pending for the rating window, commission goes to Origin", { skip: SKIP }, async () => {
  await setSetting("now_welcome_coins", "200", null);
  const student = await seedUser("now_student");
  const solver = await seedUser("now_solver");
  const requestId = makeId("req");
  const endedAt = new Date();
  try {
    await ensureWelcomeGrant(student);
    await postTransfers([sessionHold(student, requestId, 100)]);
    await postTransfers(
      sessionCapture({ requestId, heldCoins: 100, solverKind: "human", solverUserId: solver, commissionBps: 1_000, endedAt }),
    );
    const now = await getWalletBalance(solver, new Date(endedAt.getTime() + 60_000));
    assert.deepEqual(now, { available: 0, pending: 90, expiredUnposted: 0 });
    const later = await getWalletBalance(solver, new Date(endedAt.getTime() + RATING_WINDOW_MS + 1));
    assert.equal(later.available, 90);
    const escrow = await rawPool().query(
      `SELECT COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0)::int AS net
         FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
        WHERE e.account_id = $1 AND t.request_id = $2`,
      [PLATFORM_ACCOUNTS.escrow, requestId],
    );
    assert.equal(escrow.rows[0].net, 0, "escrow nets to zero for a settled request");
  } finally {
    await removeUsers([student, solver]);
  }
});

test("a frozen account cannot spend, and every transfer is balanced", { skip: SKIP }, async () => {
  await setSetting("now_welcome_coins", "200", null);
  const student = await seedUser("now_student");
  try {
    await ensureWelcomeGrant(student);
    await setAccountFrozen(student, true);
    await assert.rejects(postTransfers([sessionHold(student, makeId("req"), 10)]), FrozenAccountError);
    await setAccountFrozen(student, false);
    assert.deepEqual(findUnbalancedTransfers(await loadAllLegsForAudit()), []);
  } finally {
    await removeUsers([student]);
    await closePool();
  }
});

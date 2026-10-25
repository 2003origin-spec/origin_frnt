/**
 * Coin gifts (decision B93) against a real Postgres: off by default; only
 * adults, verified solvers (KYC on), accounts old enough; only bought or
 * earned coins; a daily cap; by @username; never to yourself, a blocked
 * person or someone outside Origin NOW; a retried send posts once.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getGiftOptions, sendCoinGift } from "@/server/now/gift-service";
import { packPurchase } from "@/server/now/ledger-rules";
import { getWalletBalance, postTransfers } from "@/server/now/ledger-store";
import { setSetting } from "@/server/platform-settings";

import { closePool, makeId, rawPool } from "./_db";
import { NOW_SKIP, assertLedgerBalanced, cleanupNowFixtures, seedHelper, seedStudent, seedUser, setup } from "./_now";

test.after(async () => {
  if (!NOW_SKIP) await setSetting("now_transfers", JSON.stringify({ enabled: false, dailyCap: 500, minAccountAgeDays: 30, kycRequired: true }), null);
  await cleanupNowFixtures();
  await closePool();
});

const code = (c: string) => (e: { code?: string }) => e.code === c;
async function handle(userId: string): Promise<string> {
  const name = `g${makeId("").replace(/[^a-z0-9]/gi, "").slice(-12).toLowerCase()}`;
  await rawPool().query(`UPDATE origin_users SET username = $2, joined_at = NOW() - interval '60 days' WHERE id = $1`, [userId, name]);
  return name;
}

test("coin gifts: who can send, what can be sent, to whom, and only once per tap", { skip: NOW_SKIP }, async () => {
  await setup();
  // The username column comes from Student Social; add it bare here (its backfill is not needed).
  await rawPool().query(`ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS username TEXT`);
  const solver = await seedHelper("physics");
  const student = await seedStudent();
  const [solverName, studentName] = [await handle(solver.userId), await handle(student)];

  await assert.rejects(sendCoinGift(solver.userId, { toUsername: studentName, amount: 10 }, makeId("k")), code("gifts_off"), "off by default");
  assert.equal((await getGiftOptions(solver.userId)).enabled, false);
  await setSetting("now_transfers", JSON.stringify({ enabled: true, dailyCap: 100, minAccountAgeDays: 30, kycRequired: true }), null);

  // Welcome coins are not giftable; bought coins are.
  await postTransfers([{ ...packPurchase(solver.userId, 1, makeId("o")), amount: 1, kind: "welcome_grant" as const, idempotencyKey: makeId("welcome") }]);
  assert.match((await getGiftOptions(solver.userId)).blocked ?? "", /bought or earned/);
  await postTransfers([packPurchase(solver.userId, 80, makeId("order"))]);
  assert.equal((await getGiftOptions(solver.userId)).limit, 80);

  const key = makeId("k");
  const sent = await sendCoinGift(solver.userId, { toUsername: `@${studentName.toUpperCase()}`, amount: 50 }, key);
  assert.equal(sent.toName, "Meera", "first name only");
  await sendCoinGift(solver.userId, { toUsername: studentName, amount: 50 }, key);
  assert.equal((await getWalletBalance(solver.userId)).available, 31, "the same tap sent once");
  const studentCoins = await rawPool().query(
    `SELECT COALESCE(sum(amount), 0)::int AS n FROM now.ledger_entries WHERE account_id = $1 AND kind = 'transfer' AND direction = 'credit'`,
    [`user:${student}`],
  );
  assert.equal(studentCoins.rows[0].n, 50);

  await assert.rejects(sendCoinGift(solver.userId, { toUsername: studentName, amount: 31 }, makeId("k")), code("over_limit"), "30 bought coins left");
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: solverName, amount: 1 }, makeId("k")), code("self"));
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: "nobody_here_x", amount: 1 }, makeId("k")), code("no_such_user"));
  const outsider = await seedUser("Not Invited");
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: await handle(outsider), amount: 1 }, makeId("k")), code("recipient_not_member"));
  await rawPool().query(`INSERT INTO now.blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [student, solver.userId]);
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: studentName, amount: 1 }, makeId("k")), code("blocked"));
  await rawPool().query(`DELETE FROM now.blocks WHERE blocker_id = $1`, [student]);

  // A student is not a verified solver (KYC on), and gifted coins cannot move on.
  await assert.rejects(sendCoinGift(student, { toUsername: solverName, amount: 1 }, makeId("k")), code("kyc_required"));
  await setSetting("now_transfers", JSON.stringify({ enabled: true, dailyCap: 100, minAccountAgeDays: 30, kycRequired: false }), null);
  await assert.rejects(sendCoinGift(student, { toUsername: solverName, amount: 1 }, makeId("k")), code("nothing_giftable"));

  // Age and account age.
  await rawPool().query(`UPDATE origin_users SET date_of_birth = NOW() - interval '15 years' WHERE id = $1`, [solver.userId]);
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: studentName, amount: 1 }, makeId("k")), code("minor"));
  await rawPool().query(`UPDATE origin_users SET date_of_birth = '1990-01-01', joined_at = NOW() - interval '5 days' WHERE id = $1`, [solver.userId]);
  await assert.rejects(sendCoinGift(solver.userId, { toUsername: studentName, amount: 1 }, makeId("k")), code("account_too_new"));
  await assertLedgerBalanced();
});

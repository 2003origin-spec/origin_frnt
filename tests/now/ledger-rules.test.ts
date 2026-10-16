/**
 * Ori Coins ledger arithmetic. The properties that matter: transfers are
 * balanced and positive, solver earnings are pending for the rating window,
 * spending eats the soonest-expiring promo coins first, and expired promo
 * coins are written off exactly once.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  PLATFORM_ACCOUNTS,
  assertValidTransfer,
  computeWalletBalance,
  findUnbalancedTransfers,
  sessionCapture,
  sessionHold,
  sessionRelease,
  userAccount,
  welcomeGrant,
  type LedgerLeg,
} from "@/server/now/ledger-rules";
import { RATING_WINDOW_MS } from "@/server/now/types";

const t0 = new Date("2026-10-16T12:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

test("transfers must move a positive whole number between two accounts", () => {
  assert.throws(() => assertValidTransfer({ ...welcomeGrant("u1", 0) }));
  assert.throws(() => assertValidTransfer({ ...welcomeGrant("u1", 2.5) }));
  assert.throws(() => assertValidTransfer({ ...welcomeGrant("u1", 10), to: PLATFORM_ACCOUNTS.welcomeGrants }));
  assert.doesNotThrow(() => assertValidTransfer(welcomeGrant("u1", 100)));
});

test("idempotency keys are stable per operation", () => {
  assert.equal(welcomeGrant("u1", 100).idempotencyKey, "welcome:u1");
  assert.equal(sessionHold("s1", "r1", 60).idempotencyKey, "hold:r1:0");
  assert.equal(sessionHold("s1", "r1", 30, 1).kind, "extension");
});

test("a human capture splits price into solver (pending) and commission", () => {
  const legs = sessionCapture({
    requestId: "r1",
    heldCoins: 100,
    solverKind: "human",
    solverUserId: "helper-1",
    commissionBps: 1_000,
    endedAt: t0,
  });
  assert.equal(legs.length, 2);
  const [solver, commission] = legs;
  assert.equal(solver.to, userAccount("helper-1"));
  assert.equal(solver.amount, 90);
  assert.equal(solver.availableAt?.getTime(), t0.getTime() + RATING_WINDOW_MS);
  assert.equal(commission.to, PLATFORM_ACCOUNTS.commission);
  assert.equal(commission.amount, 10);
  assert.ok(legs.every((l) => l.from === PLATFORM_ACCOUNTS.escrow));
});

test("a zero-commission capture writes no commission transfer", () => {
  const legs = sessionCapture({
    requestId: "r1",
    heldCoins: 50,
    solverKind: "human",
    solverUserId: "h",
    commissionBps: 0,
    endedAt: t0,
  });
  assert.equal(legs.length, 1);
});

test("a bot capture sends the whole hold to bot revenue", () => {
  const legs = sessionCapture({ requestId: "r1", heldCoins: 60, solverKind: "bot", solverUserId: null, commissionBps: 1_500, endedAt: t0 });
  assert.deepEqual(
    legs.map((l) => [l.to, l.amount]),
    [[PLATFORM_ACCOUNTS.botRevenue, 60]],
  );
});

test("a release returns the hold to the student", () => {
  assert.deepEqual(sessionRelease("s1", "r1", 60)[0].to, userAccount("s1"));
  assert.deepEqual(sessionRelease("s1", "r1", 0), []);
});

function credit(amount: number, createdAt: Date, extra: Partial<LedgerLeg> = {}): LedgerLeg {
  return { direction: "credit", amount, createdAt, kind: "welcome_grant", ...extra };
}
function debit(amount: number, createdAt: Date, extra: Partial<LedgerLeg> = {}): LedgerLeg {
  return { direction: "debit", amount, createdAt, kind: "session_hold", ...extra };
}

test("a simple wallet: grant, hold, release", () => {
  const legs = [credit(100, at(0)), debit(60, at(1)), credit(60, at(2), { kind: "session_release" })];
  assert.deepEqual(computeWalletBalance(legs, at(5)), { available: 100, pending: 0, expiredUnposted: 0 });
});

test("solver earnings are pending until the rating window closes", () => {
  const legs = [credit(90, at(0), { kind: "session_capture", availableAt: new Date(t0.getTime() + RATING_WINDOW_MS) })];
  assert.deepEqual(computeWalletBalance(legs, at(60)), { available: 0, pending: 90, expiredUnposted: 0 });
  assert.equal(computeWalletBalance(legs, new Date(t0.getTime() + RATING_WINDOW_MS)).available, 90);
});

test("spending uses promo coins that expire soonest before permanent coins", () => {
  const legs = [
    credit(100, at(0)),
    credit(50, at(0), { kind: "promo_bonus", expiresAt: at(120) }),
    debit(50, at(10)),
  ];
  // The 50 spent came out of the promo bucket, so nothing is left to expire.
  assert.deepEqual(computeWalletBalance(legs, at(200)), { available: 100, pending: 0, expiredUnposted: 0 });
});

test("unspent promo coins expire and are written off exactly once", () => {
  const legs = [credit(100, at(0)), credit(50, at(0), { kind: "promo_bonus", expiresAt: at(120) }), debit(20, at(10))];
  const before = computeWalletBalance(legs, at(100));
  assert.deepEqual(before, { available: 130, pending: 0, expiredUnposted: 0 });
  const after = computeWalletBalance(legs, at(200));
  assert.deepEqual(after, { available: 100, pending: 0, expiredUnposted: 30 });
  const posted = [...legs, debit(30, at(201), { kind: "expiry" })];
  assert.deepEqual(computeWalletBalance(posted, at(300)), { available: 100, pending: 0, expiredUnposted: 0 });
});

test("an overdraft shows as a negative balance instead of being hidden", () => {
  const legs = [credit(10, at(0)), debit(25, at(1))];
  assert.equal(computeWalletBalance(legs, at(2)).available, -15);
});

test("the nightly zero-sum check finds unbalanced transfers", () => {
  const legs = [
    { transferId: "a", direction: "debit" as const, amount: 10 },
    { transferId: "a", direction: "credit" as const, amount: 10 },
    { transferId: "b", direction: "debit" as const, amount: 10 },
    { transferId: "b", direction: "credit" as const, amount: 9 },
  ];
  assert.deepEqual(findUnbalancedTransfers(legs), ["b"]);
});

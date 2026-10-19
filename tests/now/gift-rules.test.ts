import assert from "node:assert/strict";
import test from "node:test";

import { amountRefusal, giftLimit, senderRefusal, type GiftSenderFacts } from "../../src/server/now/gift-rules";
import { computeGiftableCoins, computeWalletBalance, type LedgerLeg } from "../../src/server/now/ledger-rules";

const on = { enabled: true, dailyCap: 500, minAccountAgeDays: 30, kycRequired: true };
const ok: GiftSenderFacts = { accountAgeDays: 90, isMinor: false, verifiedSolver: true, sentToday: 0, giftable: 300 };

test("who may send a coin gift (B93)", () => {
  assert.equal(senderRefusal(on, ok), null);
  assert.equal(senderRefusal({ ...on, enabled: false }, ok)?.code, "gifts_off");
  assert.equal(senderRefusal(on, { ...ok, isMinor: true })?.code, "minor");
  assert.equal(senderRefusal(on, { ...ok, isMinor: null })?.code, "age_unknown");
  assert.equal(senderRefusal(on, { ...ok, verifiedSolver: false })?.code, "kyc_required");
  assert.equal(senderRefusal({ ...on, kycRequired: false }, { ...ok, verifiedSolver: false }), null);
  assert.equal(senderRefusal(on, { ...ok, accountAgeDays: 29 })?.code, "account_too_new");
  assert.equal(senderRefusal(on, { ...ok, sentToday: 500 })?.code, "daily_cap");
  assert.equal(senderRefusal(on, { ...ok, giftable: 0 })?.code, "nothing_giftable");
  assert.equal(giftLimit(on, { ...ok, sentToday: 450 }), 50, "the day's cap");
  assert.equal(giftLimit(on, { ...ok, giftable: 20 }), 20, "only what was bought or earned");
  assert.equal(amountRefusal(0, 50)?.code, "invalid_amount");
  assert.equal(amountRefusal(1.5, 50)?.code, "invalid_amount");
  assert.equal(amountRefusal(51, 50)?.code, "over_limit");
  assert.equal(amountRefusal(50, 50), null);
});

const t0 = new Date("2026-10-01T10:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);
const credit = (kind: LedgerLeg["kind"], amount: number, min: number, extra: Partial<LedgerLeg> = {}): LedgerLeg => ({
  direction: "credit",
  kind,
  amount,
  createdAt: at(min),
  ...extra,
});
const debit = (kind: LedgerLeg["kind"], amount: number, min: number): LedgerLeg => ({ direction: "debit", kind, amount, createdAt: at(min) });

test("only bought or earned coins can be gifted; free coins are spent first", () => {
  const legs = [
    credit("welcome_grant", 200, 0),
    credit("pack_purchase", 300, 1),
    credit("promo_bonus", 100, 2, { expiresAt: at(10_000) }),
    debit("store_spend", 250, 3), // drains the promo (expiring) first, then the welcome coins
  ];
  assert.equal(computeWalletBalance(legs, at(5)).available, 350);
  assert.equal(computeGiftableCoins(legs, at(5)), 300, "the bought coins are untouched");
  const more = [...legs, debit("store_spend", 100, 4)];
  assert.equal(computeGiftableCoins(more, at(5)), 250, "once free coins run out, bought coins are spent");
  const pending = [credit("session_capture", 40, 0, { availableAt: at(24 * 60) })];
  assert.equal(computeGiftableCoins(pending, at(5)), 0, "pending earnings are not giftable yet");
  assert.equal(computeGiftableCoins(pending, at(25 * 60)), 40);
  assert.equal(computeGiftableCoins([credit("transfer", 50, 0)], at(5)), 0, "a gift received cannot be passed on");
  const gifted = [credit("welcome_grant", 1, 0), credit("pack_purchase", 80, 1), debit("transfer", 50, 2)];
  assert.equal(computeWalletBalance(gifted, at(5)).available, 31);
  assert.equal(computeGiftableCoins(gifted, at(5)), 30, "a gift is drawn from bought coins, never the free coin");
});

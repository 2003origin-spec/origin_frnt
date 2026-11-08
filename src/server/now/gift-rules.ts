/**
 * Coin gifts between people (decision B93) — pure rules. The switch and
 * limits are the existing `now_transfers` setting (off; daily cap 500;
 * account at least 30 days old; KYC required = only verified solvers send).
 * Only bought or earned coins can be gifted (ledger-rules
 * computeGiftableCoins), so free coins cannot be moved between accounts.
 */

import type { TransfersConfig } from "./now-settings";

export type GiftSenderFacts = {
  /** Whole days since the account was created. */
  accountAgeDays: number;
  /** Null when the date of birth is not known. */
  isMinor: boolean | null;
  /** A verified Origin NOW solver (they passed KYC). */
  verifiedSolver: boolean;
  /** Coins already gifted today (IST). */
  sentToday: number;
  /** Bought or earned coins still spendable. */
  giftable: number;
};

export type GiftRefusal = { code: string; message: string };

export const MAX_GIFT_COINS = 100_000;

/** Why this person cannot send a gift right now (null when they can send at least one coin). */
export function senderRefusal(config: TransfersConfig, f: GiftSenderFacts): GiftRefusal | null {
  if (!config.enabled) return { code: "gifts_off", message: "Coin gifts are not switched on." };
  if (f.isMinor === null) return { code: "age_unknown", message: "Coin gifts need your date of birth on your account." };
  if (f.isMinor) return { code: "minor", message: "Coin gifts are for people 18 or older." };
  if (config.kycRequired && !f.verifiedSolver) return { code: "kyc_required", message: "Only verified solvers can send coin gifts." };
  if (f.accountAgeDays < config.minAccountAgeDays) {
    return { code: "account_too_new", message: `Your account must be at least ${config.minAccountAgeDays} days old to send coin gifts.` };
  }
  if (f.sentToday >= config.dailyCap) return { code: "daily_cap", message: `You have sent today's limit of ${config.dailyCap} coins.` };
  if (f.giftable <= 0) return { code: "nothing_giftable", message: "Only coins you bought or earned can be gifted, and you have none left." };
  return null;
}

/** The most this person can gift now. */
export function giftLimit(config: TransfersConfig, f: GiftSenderFacts): number {
  return Math.max(0, Math.min(config.dailyCap - f.sentToday, f.giftable, MAX_GIFT_COINS));
}

export function amountRefusal(amount: number, limit: number): GiftRefusal | null {
  if (!Number.isInteger(amount) || amount < 1) return { code: "invalid_amount", message: "Send a whole number of coins, 1 or more." };
  if (amount > limit) return { code: "over_limit", message: `You can send up to ${limit} coins right now.` };
  return null;
}

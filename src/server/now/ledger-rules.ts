/**
 * Ori Coins ledger arithmetic — pure, no DB (plan doc, "Coin ledger
 * invariants").
 *
 * Every movement is a TRANSFER: exactly one debit leg and one credit leg of the
 * same whole-coin amount, written in one transaction. Balances are never
 * stored; they are computed from the legs. Platform accounts (welcome grants,
 * coin issuance, escrow, revenue…) are Origin's own books and may go negative —
 * that is simply the issuer's side. User accounts must never go negative.
 *
 * Solver earnings carry `availableAt` (session end + rating window): they are
 * visible as "pending" but not spendable until then, so a refund inside the
 * window comes out of escrow-like pending money instead of debiting a solver
 * below zero. Promotion coins carry `expiresAt`; spending consumes the coins
 * that expire soonest first.
 */

import { RATING_WINDOW_MS } from "./types";

export const PLATFORM_ACCOUNTS = {
  /** Source of every welcome grant. */
  welcomeGrants: "platform:welcome_grants",
  /** Source of coins sold in packs. */
  issuance: "platform:issuance",
  /** Source of promotion bonuses. */
  promotions: "platform:promotions",
  /** Session holds wait here until captured or released. */
  escrow: "platform:escrow",
  /** Commission on human sessions. */
  commission: "platform:commission",
  /** Full price of bot sessions. */
  botRevenue: "platform:bot_revenue",
  /** Coins spent in the Origin Store. */
  store: "platform:store",
  /** Source of admin corrections (always credits to users). */
  adjustments: "platform:adjustments",
  /** Sink for expired promotion coins. */
  expired: "platform:expired",
} as const;

export function userAccount(userId: string): string {
  return `user:${userId}`;
}

export function isUserAccount(account: string): boolean {
  return account.startsWith("user:");
}

export type TransferKind =
  | "welcome_grant"
  | "pack_purchase"
  | "promo_bonus"
  | "session_hold"
  | "session_capture"
  | "session_release"
  | "extension"
  | "tip"
  | "commission"
  | "transfer"
  | "store_spend"
  | "expiry"
  | "admin_adjustment"
  | "pack_refund";

/** One movement of coins from `from` to `to`. */
export type Transfer = {
  kind: TransferKind;
  from: string;
  to: string;
  amount: number;
  /** Credit becomes spendable only at this time (solver earnings, tips). */
  availableAt?: Date | null;
  /** Credit stops being spendable at this time (promotion coins). */
  expiresAt?: Date | null;
  requestId?: string | null;
  orderRef?: string | null;
  /** Unique per logical operation; a retry with the same key is a no-op. */
  idempotencyKey: string;
};

export function assertValidTransfer(t: Transfer): void {
  if (!Number.isInteger(t.amount) || t.amount <= 0) {
    throw new Error(`Transfer ${t.kind} must move a positive whole number of coins (got ${t.amount}).`);
  }
  if (t.from === t.to) throw new Error(`Transfer ${t.kind} cannot move coins to the same account.`);
  if (!t.idempotencyKey) throw new Error(`Transfer ${t.kind} needs an idempotency key.`);
}

// ---------------------------------------------------------------------------
// Transfer builders — one per business operation.

export function welcomeGrant(userId: string, coins: number): Transfer {
  return {
    kind: "welcome_grant",
    from: PLATFORM_ACCOUNTS.welcomeGrants,
    to: userAccount(userId),
    amount: coins,
    idempotencyKey: `welcome:${userId}`,
  };
}

export function packPurchase(userId: string, coins: number, orderId: string): Transfer {
  return {
    kind: "pack_purchase",
    from: PLATFORM_ACCOUNTS.issuance,
    to: userAccount(userId),
    amount: coins,
    orderRef: orderId,
    idempotencyKey: `pack:${orderId}`,
  };
}

export function promoBonus(userId: string, coins: number, promoKey: string, expiresAt: Date | null): Transfer {
  return {
    kind: "promo_bonus",
    from: PLATFORM_ACCOUNTS.promotions,
    to: userAccount(userId),
    amount: coins,
    expiresAt,
    idempotencyKey: `promo:${promoKey}:${userId}`,
  };
}

export function sessionHold(studentId: string, requestId: string, coins: number, step = 0): Transfer {
  return {
    kind: step === 0 ? "session_hold" : "extension",
    from: userAccount(studentId),
    to: PLATFORM_ACCOUNTS.escrow,
    amount: coins,
    requestId,
    idempotencyKey: `hold:${requestId}:${step}`,
  };
}

/**
 * Settles a payable session out of escrow. Human: price minus commission to the
 * solver (pending for the rating window) and commission to Origin. Bot: the
 * whole amount to Origin's bot revenue.
 */
export function sessionCapture(input: {
  requestId: string;
  heldCoins: number;
  solverKind: "human" | "bot";
  solverUserId: string | null;
  commissionBps: number;
  endedAt: Date;
}): Transfer[] {
  const { requestId, heldCoins } = input;
  if (heldCoins <= 0) return [];
  if (input.solverKind === "bot") {
    return [
      {
        kind: "session_capture",
        from: PLATFORM_ACCOUNTS.escrow,
        to: PLATFORM_ACCOUNTS.botRevenue,
        amount: heldCoins,
        requestId,
        idempotencyKey: `capture:${requestId}`,
      },
    ];
  }
  if (!input.solverUserId) throw new Error("A human capture needs the solver's user id.");
  const platform = Math.floor((heldCoins * input.commissionBps) / 10_000);
  const solver = heldCoins - platform;
  const out: Transfer[] = [];
  if (solver > 0) {
    out.push({
      kind: "session_capture",
      from: PLATFORM_ACCOUNTS.escrow,
      to: userAccount(input.solverUserId),
      amount: solver,
      availableAt: new Date(input.endedAt.getTime() + RATING_WINDOW_MS),
      requestId,
      idempotencyKey: `capture:${requestId}`,
    });
  }
  if (platform > 0) {
    out.push({
      kind: "commission",
      from: PLATFORM_ACCOUNTS.escrow,
      to: PLATFORM_ACCOUNTS.commission,
      amount: platform,
      requestId,
      idempotencyKey: `commission:${requestId}`,
    });
  }
  return out;
}

export function sessionRelease(studentId: string, requestId: string, heldCoins: number): Transfer[] {
  if (heldCoins <= 0) return [];
  return [
    {
      kind: "session_release",
      from: PLATFORM_ACCOUNTS.escrow,
      to: userAccount(studentId),
      amount: heldCoins,
      requestId,
      idempotencyKey: `release:${requestId}`,
    },
  ];
}

export function tip(studentId: string, solverUserId: string, requestId: string, coins: number, now: Date): Transfer {
  return {
    kind: "tip",
    from: userAccount(studentId),
    to: userAccount(solverUserId),
    amount: coins,
    availableAt: new Date(now.getTime() + RATING_WINDOW_MS),
    requestId,
    idempotencyKey: `tip:${requestId}`,
  };
}

export function storeSpend(userId: string, coins: number, orderId: string): Transfer {
  return {
    kind: "store_spend",
    from: userAccount(userId),
    to: PLATFORM_ACCOUNTS.store,
    amount: coins,
    orderRef: orderId,
    idempotencyKey: `store:${orderId}`,
  };
}

export function adminCredit(userId: string, coins: number, adjustmentId: string): Transfer {
  return {
    kind: "admin_adjustment",
    from: PLATFORM_ACCOUNTS.adjustments,
    to: userAccount(userId),
    amount: coins,
    idempotencyKey: `adjust:${adjustmentId}`,
  };
}

export function userTransfer(fromUserId: string, toUserId: string, coins: number, transferId: string): Transfer {
  return {
    kind: "transfer",
    from: userAccount(fromUserId),
    to: userAccount(toUserId),
    amount: coins,
    idempotencyKey: `p2p:${transferId}`,
  };
}

/** Takes coins back when a coin-pack payment is refunded (only what is still spendable). */
export function packRefund(userId: string, coins: number, orderId: string): Transfer {
  return {
    kind: "pack_refund",
    from: userAccount(userId),
    to: PLATFORM_ACCOUNTS.issuance,
    amount: coins,
    orderRef: orderId,
    idempotencyKey: `pack_refund:${orderId}`,
  };
}

export function promoExpiry(userId: string, coins: number, runKey: string): Transfer {
  return {
    kind: "expiry",
    from: userAccount(userId),
    to: PLATFORM_ACCOUNTS.expired,
    amount: coins,
    idempotencyKey: `expiry:${runKey}:${userId}`,
  };
}

// ---------------------------------------------------------------------------
// Balances.

/** One leg as stored in `now.ledger_entries`, seen from a single account. */
export type LedgerLeg = {
  direction: "debit" | "credit";
  amount: number;
  createdAt: Date;
  availableAt?: Date | null;
  expiresAt?: Date | null;
  kind: TransferKind;
};

export type WalletBalance = {
  /** Spendable now. */
  available: number;
  /** Earned but inside the rating window. */
  pending: number;
  /** Promotion coins that expired unspent and have not yet been written off. */
  expiredUnposted: number;
};

type Bucket = { remaining: number; expiresAt: number | null };

/**
 * Replays an account's legs in time order. Each credit becomes a bucket once it
 * is available; each debit drains the buckets that expire soonest first
 * (non-expiring coins last); a bucket that passes its expiry stops counting.
 * Posted `expiry` debits are subtracted from the expired total so the nightly
 * job writes each expired coin off exactly once.
 */
export function computeWalletBalance(legs: readonly LedgerLeg[], now: Date): WalletBalance {
  const nowMs = now.getTime();
  type Event = { at: number; order: number; leg: LedgerLeg };
  const events: Event[] = [];
  let pending = 0;
  legs.forEach((leg, index) => {
    if (leg.direction === "credit") {
      // Only an explicit available_at (solver earnings) makes a credit pending.
      // A plain credit is spendable once committed, even if its timestamp is a
      // few ms after the caller's `now` (a welcome grant posted mid-request).
      if (leg.availableAt && leg.availableAt.getTime() > nowMs) {
        pending += leg.amount;
        return;
      }
      events.push({ at: leg.availableAt ? leg.availableAt.getTime() : leg.createdAt.getTime(), order: index, leg });
    } else {
      events.push({ at: leg.createdAt.getTime(), order: index, leg });
    }
  });
  events.sort((a, b) => a.at - b.at || a.order - b.order);

  const buckets: Bucket[] = [];
  let expiredTotal = 0;
  let postedExpiry = 0;
  let overdraft = 0;

  const expireUpTo = (at: number) => {
    for (const bucket of buckets) {
      if (bucket.expiresAt !== null && bucket.expiresAt <= at && bucket.remaining > 0) {
        expiredTotal += bucket.remaining;
        bucket.remaining = 0;
      }
    }
  };

  for (const event of events) {
    expireUpTo(event.at);
    const { leg } = event;
    if (leg.direction === "credit") {
      buckets.push({ remaining: leg.amount, expiresAt: leg.expiresAt ? leg.expiresAt.getTime() : null });
      continue;
    }
    if (leg.kind === "expiry") {
      // Writing off coins that already left the buckets when they expired.
      postedExpiry += leg.amount;
      continue;
    }
    let toDrain = leg.amount;
    const order = buckets
      .filter((b) => b.remaining > 0)
      .sort((a, b) => (a.expiresAt ?? Number.POSITIVE_INFINITY) - (b.expiresAt ?? Number.POSITIVE_INFINITY));
    for (const bucket of order) {
      if (toDrain === 0) break;
      const take = Math.min(bucket.remaining, toDrain);
      bucket.remaining -= take;
      toDrain -= take;
    }
    overdraft += toDrain;
  }
  expireUpTo(nowMs);

  const live = buckets.reduce((sum, b) => sum + b.remaining, 0);
  return {
    available: live - overdraft,
    pending,
    expiredUnposted: Math.max(0, expiredTotal - postedExpiry),
  };
}

/**
 * Nightly zero-sum check: every transfer's legs must net to zero. Returns the
 * ids that do not, which is an incident, not a warning.
 */
export function findUnbalancedTransfers(
  legs: readonly { transferId: string; direction: "debit" | "credit"; amount: number }[],
): string[] {
  const net = new Map<string, number>();
  for (const leg of legs) {
    const signed = leg.direction === "credit" ? leg.amount : -leg.amount;
    net.set(leg.transferId, (net.get(leg.transferId) ?? 0) + signed);
  }
  return [...net.entries()].filter(([, value]) => value !== 0).map(([id]) => id);
}

/**
 * Failure budgets for the join-code guessing surfaces (see rate-limit.ts).
 *
 * Every surface that tells a caller whether a student join code exists —
 * the Phase-3 join, the Flow-1 redeem and the teacher code-availability check —
 * is charged only on a miss.
 *
 * Student join / redeem: the per-USER budget is checked fail-closed BEFORE the
 * lookup (it is the guessing guard). The per-IP budget is checked before the
 * lookup too, but only against a user who already has a miss in the window:
 * once the IP is spent, a user with a clean record still gets their code
 * looked up (a correct code from a school NAT is accepted; a wrong one is
 * charged and refused), while a user who has missed before is refused outright
 * — so a spent IP is no longer a right/wrong oracle for N throwaway accounts
 * at 10 misses each (round-3 review R3-4); each gets at most one more guess.
 */

import {
  checkFailureBudget,
  codeCheckFailureIpLimiter,
  codeCheckFailureLimiter,
  joinCodeFailureIpLimiter,
  joinCodeFailureLimiter,
  type FailureBudgetKey,
} from "@/lib/rate-limit";

function clientIpOf(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "anonymous";
}

export type JoinCodeFailureKeys = {
  /** Read before the lookup for every caller (per user). */
  precheck: FailureBudgetKey[];
  /** Charged on a miss (per user + per IP); its 429 refuses only that wrong code. */
  charge: FailureBudgetKey[];
  /** The per-IP budget, read before the lookup for a user with ≥1 miss. */
  ipGate: { ip: FailureBudgetKey; user: FailureBudgetKey };
};

/** Student join / redeem miss budgets, shared by both routes (see checkJoinCodeBudget). */
export function joinCodeFailureKeys(userId: string, request: Request): JoinCodeFailureKeys {
  const user: FailureBudgetKey = { limiter: joinCodeFailureLimiter, identifier: `user:${userId}` };
  const ip: FailureBudgetKey = { limiter: joinCodeFailureIpLimiter, identifier: `ip:${clientIpOf(request)}` };
  return { precheck: [user], charge: [user, ip], ipGate: { ip, user } };
}

/**
 * Pre-lookup gate for join / redeem. 429 when the user's own budget is spent,
 * or when the IP budget is spent AND this user already missed in the window.
 * Fail-closed on a limiter backend error, like checkFailureBudget.
 */
export async function checkJoinCodeBudget(keys: JoinCodeFailureKeys): Promise<Response | null> {
  const userExhausted = await checkFailureBudget(keys.precheck);
  if (userExhausted) return userExhausted;
  const ipExhausted = await checkFailureBudget([keys.ipGate.ip]);
  if (!ipExhausted) return null;
  const { limiter, identifier } = keys.ipGate.user;
  try {
    // A user with no miss in the window keeps one lookup: a right code is accepted.
    // A limiter that does not know its budget cannot tell, so it keeps that lookup too.
    if (limiter.max == null) return null;
    if ((await limiter.remaining(identifier)) >= limiter.max) return null;
  } catch (error) {
    console.error("[join-code-guard] user miss count unreadable; blocking (fail-closed)", error);
  }
  return ipExhausted;
}

/** Teacher code-availability check: a looser budget (it runs as the teacher types). */
export function codeCheckFailureKeys(userId: string, request: Request): FailureBudgetKey[] {
  return [
    { limiter: codeCheckFailureLimiter, identifier: `user:${userId}` },
    { limiter: codeCheckFailureIpLimiter, identifier: `ip:${clientIpOf(request)}` },
  ];
}

/** A join/redeem error that means "no such code" — the only outcome charged. */
export function isJoinCodeMiss(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 404;
}

/**
 * Undo point-award claims when the store write they belong to fails (review L2).
 *
 * `claimPointAward` commits its `app.point_awards` row BEFORE the scoped store
 * persist that writes the matching point log + total. If anything after the
 * claim throws (the room finish after a submit, or the persist itself, which
 * rolls back as one transaction), the claim would stay used while the award
 * was never written, and every retry would answer `alreadyRewarded`.
 *
 * `withStoreAsync` / `withStoreAsyncScoped` run their mutate + persist inside
 * `withPointAwardClaimRollback`; each successful claim made in that async
 * context is tracked here, and on a throw the tracked claims are deleted again
 * (exact user + key + reference match, so a claim made by another request is
 * never touched). Outside a store mutation nothing is tracked.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface TrackedPointAwardClaim {
  userId: string;
  awardKey: string;
  referenceId: string | null;
}

/** The subset of `pg.Pool` used to release claims — tests pass a stub. */
export interface PointAwardReleasePool {
  query: (sql: string, params: unknown[]) => Promise<unknown>;
}

const scope = new AsyncLocalStorage<TrackedPointAwardClaim[]>();

/** Record a claim that was just won, if we are inside a store mutation. */
export function trackPointAwardClaim(claim: TrackedPointAwardClaim): void {
  scope.getStore()?.push(claim);
}

export const RELEASE_POINT_AWARD_SQL = `
DELETE FROM app.point_awards
 WHERE user_id = $1 AND award_key = $2 AND reference_id IS NOT DISTINCT FROM $3
`;

/** Delete the given claims (best effort; a failure is logged, never thrown). */
export async function releasePointAwardClaims(
  claims: readonly TrackedPointAwardClaim[],
  pool: PointAwardReleasePool | null,
): Promise<number> {
  if (!pool || claims.length === 0) return 0;
  let released = 0;
  for (const claim of claims) {
    try {
      await pool.query(RELEASE_POINT_AWARD_SQL, [claim.userId, claim.awardKey, claim.referenceId]);
      released += 1;
    } catch (error) {
      console.warn(`[point-awards] could not release claim ${claim.awardKey} after a failed store write`, error);
    }
  }
  return released;
}

/**
 * Run `fn`; if it throws, release every claim won inside it, then rethrow.
 * `getPool` is resolved lazily so callers without Postgres pay nothing.
 */
export async function withPointAwardClaimRollback<T>(
  fn: () => Promise<T>,
  getPool: () => PointAwardReleasePool | null,
): Promise<T> {
  const claims: TrackedPointAwardClaim[] = [];
  try {
    return await scope.run(claims, fn);
  } catch (error) {
    if (claims.length) await releasePointAwardClaims(claims, getPool());
    throw error;
  }
}

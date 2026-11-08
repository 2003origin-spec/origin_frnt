/**
 * Pure planning for scripts/backfill-point-awards.ts (no DB access), so the
 * numbers it prints and applies are unit-testable.
 *
 * Rule (review M8): the backfill only ever DEDUCTS the points of duplicate
 * awards for the same (user, test/dpp), from the user's stored total:
 *
 *   newTotal = GREATEST(0, storedTotal − farmedPoints)
 *
 * It never rebuilds a total from `app.point_logs`: the old whole-store-rewrite
 * race (N3) erased log rows and score rows independently, so the log is not a
 * complete ledger and a recompute would also strip legitimate points. The
 * ledger number is still computed, for the dry-run comparison only.
 */

export interface BackfillAttempt {
  id: string;
  userId: string;
  /** `test:<testId>` / `dpp:<dppId>`. */
  awardKey: string;
  score: number;
  createdAt: string;
}

export interface BackfillPointLog {
  id: string;
  userId: string;
  points: number;
  activityType: string;
  referenceId: string | null;
  /** Already flagged `data.farmed = true` by an earlier --apply run. */
  farmedAlready: boolean;
}

export interface FarmerPlan {
  userId: string;
  /** Duplicate awards not yet flagged. */
  extraAwards: number;
  /** Points those duplicate awards paid out (positive amounts only). */
  farmedPoints: number;
  farmedLogIds: string[];
  storedTotal: number | null;
  /** What --apply sets: GREATEST(0, stored − farmedPoints). */
  newTotal: number;
  /** For comparison only: GREATEST(0, Σ non-farmed log rows). Never applied. */
  ledgerTotal: number;
}

export interface PointAwardsBackfillPlan {
  /** First rewardable (score > 0) attempt per (user, award_key): the claim to seed. */
  firstRewardable: BackfillAttempt[];
  farmedLogs: BackfillPointLog[];
  farmers: FarmerPlan[];
  /** Non-farmers whose stored total differs from their log sum (reported, never touched). */
  nonFarmerMismatches: Array<{ userId: string; stored: number; ledger: number }>;
}

/** Points one duplicate award paid out; a non-positive log row is not an award. */
export function farmedAwardPoints(points: number): number {
  return Number.isFinite(points) && points > 0 ? points : 0;
}

/** The only change --apply makes to a total: subtract the duplicate awards, floor at 0. */
export function deductFarmedPoints(storedTotal: number | null, farmedPoints: number): number {
  const stored = Number.isFinite(storedTotal) ? (storedTotal as number) : 0;
  return Math.max(0, stored - Math.max(0, farmedPoints));
}

function userKey(userId: string, awardKey: string): string {
  return `${userId}\u0000${awardKey}`;
}

export function planPointAwardsBackfill(input: {
  attempts: readonly BackfillAttempt[];
  logs: readonly BackfillPointLog[];
  storedTotals: ReadonlyMap<string, number>;
}): PointAwardsBackfillPlan {
  const { attempts, logs, storedTotals } = input;

  // First rewardable attempt per (user, award_key): the earliest attempt with a
  // positive score, the one the runtime claim would have taken. `attempts` must
  // be ordered by (created_at, id) within each key.
  const firstByKey = new Map<string, BackfillAttempt>();
  const attemptById = new Map<string, BackfillAttempt>();
  for (const attempt of attempts) {
    attemptById.set(attempt.id, attempt);
    if (attempt.score <= 0) continue;
    const key = userKey(attempt.userId, attempt.awardKey);
    if (!firstByKey.has(key)) firstByKey.set(key, attempt);
  }

  // Farmed = an assessment-award log (practice/dpp) whose reference is an
  // attempt of the same user that is NOT that (user, test/dpp)'s first
  // rewardable attempt. Every other log row is out of scope. Rows flagged by
  // an earlier run are skipped, so a re-run never deducts twice.
  const farmedLogs: BackfillPointLog[] = [];
  for (const log of logs) {
    if (log.farmedAlready || !log.referenceId) continue;
    if (log.activityType !== "practice" && log.activityType !== "dpp") continue;
    const attempt = attemptById.get(log.referenceId);
    if (!attempt || attempt.userId !== log.userId) continue;
    const first = firstByKey.get(userKey(attempt.userId, attempt.awardKey));
    if (first && first.id === attempt.id) continue;
    farmedLogs.push(log);
  }
  const farmedIds = new Set(farmedLogs.map((log) => log.id));

  const ledger = new Map<string, number>();
  for (const log of logs) {
    if (farmedIds.has(log.id) || log.farmedAlready) continue;
    ledger.set(log.userId, (ledger.get(log.userId) ?? 0) + log.points);
  }

  const byUser = new Map<string, FarmerPlan>();
  for (const log of farmedLogs) {
    const entry = byUser.get(log.userId) ?? {
      userId: log.userId,
      extraAwards: 0,
      farmedPoints: 0,
      farmedLogIds: [],
      storedTotal: storedTotals.get(log.userId) ?? null,
      newTotal: 0,
      ledgerTotal: Math.max(0, ledger.get(log.userId) ?? 0),
    };
    entry.extraAwards += 1;
    entry.farmedPoints += farmedAwardPoints(log.points);
    entry.farmedLogIds.push(log.id);
    byUser.set(log.userId, entry);
  }
  const farmers = [...byUser.values()].map((entry) => ({
    ...entry,
    newTotal: deductFarmedPoints(entry.storedTotal, entry.farmedPoints),
  }));

  const nonFarmerMismatches: PointAwardsBackfillPlan["nonFarmerMismatches"] = [];
  for (const [userId, stored] of storedTotals) {
    if (byUser.has(userId)) continue;
    const ledgerSum = Math.max(0, ledger.get(userId) ?? 0);
    if (ledgerSum !== stored) nonFarmerMismatches.push({ userId, stored, ledger: ledgerSum });
  }

  return { firstRewardable: [...firstByKey.values()], farmedLogs, farmers, nonFarmerMismatches };
}

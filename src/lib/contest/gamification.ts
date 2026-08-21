/**
 * Contest gamification — pure decisions (plan Phase 8). Given a participant's
 * result for a contest, decide which badges they earned and how their streak /
 * personal-bests move. The service persists; this module just decides.
 */

export const CONTEST_STREAK_MILESTONES = [3, 5, 10, 25, 50] as const;

export type ContestBadge =
  | "top_1_percent"
  | "speedster"
  | "sharpshooter"
  | "comeback"
  | "origin_legend";

export interface ResultForBadges {
  rank: number;
  percentile: number; // 0..100
  totalRanked: number;
  correct: number;
  incorrect: number;
  /** Player's time vs the field median (ratio < 1 = faster). null if unknown. */
  timeVsMedian: number | null;
  /** ORBIT rating after this contest. */
  orbitAfter: number;
  /** ORBIT rating change this contest (for the Comeback badge). */
  orbitChange: number;
}

/**
 * Badges earned from one contest result:
 *  - top_1_percent : percentile ≥ 99
 *  - speedster     : finished notably faster than the field (≤ 70% of median)
 *  - sharpshooter  : high accuracy (≥ 10 correct AND zero incorrect)
 *  - comeback      : a big positive ORBIT jump (≥ +50)
 *  - origin_legend : ORBIT reached the top tier (≥ 2000)
 */
export function badgesForResult(r: ResultForBadges): ContestBadge[] {
  const badges: ContestBadge[] = [];
  if (r.totalRanked >= 100 && r.percentile >= 99) badges.push("top_1_percent");
  if (r.timeVsMedian !== null && r.timeVsMedian <= 0.7 && r.rank <= Math.ceil(r.totalRanked * 0.25)) {
    badges.push("speedster");
  }
  if (r.correct >= 10 && r.incorrect === 0) badges.push("sharpshooter");
  if (r.orbitChange >= 50) badges.push("comeback");
  if (r.orbitAfter >= 2000) badges.push("origin_legend");
  return badges;
}

/**
 * The next streak value given the previous streak and whether the previous
 * contest a user participated in was the immediately-preceding one. We track
 * "consecutive contests participated"; a gap resets to 1.
 */
export function nextStreak(previousStreak: number, participatedConsecutively: boolean): number {
  return participatedConsecutively ? Math.max(1, previousStreak) + 1 : 1;
}

/** Which streak milestone (if any) this streak value newly hits. */
export function streakMilestoneHit(streak: number): number | null {
  return (CONTEST_STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : null;
}

export interface PersonalBests {
  highestOrbit: number | null;
  bestRank: number | null;
  bestPercentile: number | null;
}

/** Merge a new result into the running personal bests (higher orbit/percentile,
 *  lower rank number are "better"). */
export function mergePersonalBests(
  current: PersonalBests,
  result: { orbitAfter: number; rank: number; percentile: number },
): PersonalBests {
  return {
    highestOrbit: Math.max(current.highestOrbit ?? -Infinity, result.orbitAfter),
    bestRank: Math.min(current.bestRank ?? Infinity, result.rank),
    bestPercentile: Math.max(current.bestPercentile ?? -Infinity, result.percentile),
  };
}

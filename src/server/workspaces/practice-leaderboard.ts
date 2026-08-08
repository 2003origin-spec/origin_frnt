/**
 * Ranking for the batch "Top Practitioners" board.
 * Plan: V1/allmd/TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md (D5, D5a)
 *
 * Pure — no database, no I/O — so the ranking rules are unit-testable and the
 * teacher can be told exactly why a student sits where they do.
 */

import type { BatchPracticeRowLite } from "./batch-cohort-store";

/**
 * How much of the combined index comes from the teacher's own shared DPPs
 * versus the student's self-directed OG Code practice.
 *
 * Weighted toward DPPs on purpose: this is the teacher's board, and work they
 * assigned should outrank work they didn't. Tunable in one place.
 */
export const PRACTICE_INDEX_DPP_WEIGHT = 0.6;
export const PRACTICE_INDEX_OGCODE_WEIGHT = 1 - PRACTICE_INDEX_DPP_WEIGHT;

/** Which number the board is ranked on. */
export type PracticeRankBasis = "combined" | "dpp" | "ogcode";

export type PracticeLeaderboardEntry = BatchPracticeRowLite & {
  rank: number;
  /** DPP marks as a percentage of marks available, or null if none attempted. */
  dppAccuracy: number | null;
  /** 0–100 blended ranking score (see computePracticeIndex). */
  practiceIndex: number;
};

/**
 * Blends the two practice signals into one 0–100 number, scaled against the
 * best performer in this batch for each component.
 *
 * Normalising is not cosmetic. In production OG Code totals already reach
 * ~4 700 while a shared DPP is worth ~50–200 marks, so adding the two raw
 * numbers would make the board almost purely OG Code and bury the work the
 * teacher actually set. Scaling each component to the batch leader first makes
 * the weights mean what they say.
 */
export function computePracticeIndex(
  row: Pick<BatchPracticeRowLite, "dppScore" | "ogcodeScore">,
  maxDppScore: number,
  maxOgcodeScore: number,
): number {
  const dppNorm = maxDppScore > 0 ? Math.max(0, row.dppScore) / maxDppScore : 0;
  const ogcodeNorm = maxOgcodeScore > 0 ? Math.max(0, row.ogcodeScore) / maxOgcodeScore : 0;
  const blended = PRACTICE_INDEX_DPP_WEIGHT * dppNorm + PRACTICE_INDEX_OGCODE_WEIGHT * ogcodeNorm;
  return Math.round(blended * 100);
}

function accuracyOf(row: BatchPracticeRowLite): number | null {
  if (row.dppTotalMarks <= 0) return null;
  return Math.round((row.dppScore / row.dppTotalMarks) * 1000) / 10;
}

/**
 * Ranks the batch's practitioners.
 *
 * `basis` picks the ranking key — "who is doing the work I set" and "who grinds
 * the bank" are different questions, and a teacher will want both. Every raw
 * component is returned regardless of basis, so nothing is hidden behind the
 * blended index.
 *
 * Ties break on DPP accuracy, then DPPs completed — quality before volume once
 * the headline number is equal. Students with no practice at all are kept (rank
 * last) rather than dropped, because "who has not started" is exactly the
 * signal a teacher opens this board for.
 */
export function rankPractitioners(
  rows: readonly BatchPracticeRowLite[],
  basis: PracticeRankBasis = "combined",
): PracticeLeaderboardEntry[] {
  if (rows.length === 0) return [];
  const maxDppScore = Math.max(0, ...rows.map((r) => r.dppScore));
  const maxOgcodeScore = Math.max(0, ...rows.map((r) => r.ogcodeScore));

  const scored = rows.map((row) => ({
    ...row,
    dppAccuracy: accuracyOf(row),
    practiceIndex: computePracticeIndex(row, maxDppScore, maxOgcodeScore),
  }));

  const keyOf = (entry: (typeof scored)[number]): number => {
    if (basis === "dpp") return entry.dppScore;
    if (basis === "ogcode") return entry.ogcodeScore;
    return entry.practiceIndex;
  };

  return scored
    .sort(
      (a, b) =>
        keyOf(b) - keyOf(a) ||
        (b.dppAccuracy ?? -1) - (a.dppAccuracy ?? -1) ||
        b.dppsCompleted - a.dppsCompleted ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export type PracticeLeaderboardSummary = {
  /** Students with at least one scored DPP or one attempted OG Code question. */
  activePractitioners: number;
  totalStudents: number;
  dppsCompleted: number;
  /** Mean DPP accuracy across students who attempted at least one. */
  meanDppAccuracy: number | null;
  totalOgcodeQuestions: number;
};

export function summarisePractice(
  entries: readonly PracticeLeaderboardEntry[],
): PracticeLeaderboardSummary {
  const accuracies = entries
    .map((e) => e.dppAccuracy)
    .filter((a): a is number => a !== null);
  return {
    activePractitioners: entries.filter((e) => e.dppsCompleted > 0 || e.ogcodeQuestions > 0).length,
    totalStudents: entries.length,
    dppsCompleted: entries.reduce((sum, e) => sum + e.dppsCompleted, 0),
    meanDppAccuracy: accuracies.length
      ? Math.round((accuracies.reduce((s, a) => s + a, 0) / accuracies.length) * 10) / 10
      : null,
    totalOgcodeQuestions: entries.reduce((sum, e) => sum + e.ogcodeQuestions, 0),
  };
}

/**
 * Pure helpers for the landing-page Rank Predictor widget (plan §9.2): where
 * the dial needle points and the compact chips. No React,
 * no I/O, so the unit tests can pin them.
 */

import { STATE_RANK_TEXT } from '@/lib/rank-predictor/format';
import type { Prediction, RankBand, RankPredictorExam } from '@/lib/rank-predictor/types';

/**
 * Rough size of each exam's rank list, only to place the dial needle (never
 * shown as a number). NEET ~22.7 lakh appeared, JEE Main ~14 lakh, JEE
 * Advanced ~1.8 lakh appeared (2025–2026 official counts, rounded up).
 */
const DIAL_SCALE: Readonly<Record<RankPredictorExam, number>> = Object.freeze({
  neet: 2_300_000,
  'jee-main': 1_500_000,
  'jee-advanced': 200_000,
});

/**
 * Needle position, 0 = far left (bottom of the list) … 1 = far right (rank 1).
 * Log scale, because the difference between AIR 100 and 1,000 matters as much
 * to a student as 10,000 vs 1,00,000. Not on the list → 0.
 */
export function dialFraction(exam: RankPredictorExam, air: RankBand | null): number {
  if (!air) return 0;
  const mid = Math.sqrt(Math.max(1, air.low) * Math.max(1, air.high));
  const scale = DIAL_SCALE[exam];
  const f = 1 - Math.log10(Math.min(mid, scale)) / Math.log10(scale);
  return Math.min(1, Math.max(0.02, f));
}

export type CompactChip = { key: string; label: string; band: RankBand | null; text: string | null };

/** Category rank + state rank, in the same words as the full page (§9.1). */
export function compactChips(p: Prediction): CompactChip[] {
  const chips: CompactChip[] = [];
  if (p.categoryRank) {
    chips.push({ key: 'category', label: p.categoryRank.label ?? 'Category rank', band: p.categoryRank, text: null });
  }
  if (p.stateRankStatus === 'ok' && p.stateRank) {
    chips.push({ key: 'state', label: p.stateRank.label ?? 'State rank', band: p.stateRank, text: null });
  } else {
    const status = p.stateRankStatus === 'ok' ? 'not_available' : p.stateRankStatus;
    chips.push({ key: 'state', label: 'State rank', band: null, text: STATE_RANK_TEXT[status] });
  }
  return chips;
}

/** "Data: A · B and 2 more · checked dd/mm/yyyy" — the full list (with links) is on the page. */
export function sourcesLine(sources: { publisher: string }[], checkedOn: string): string {
  const publishers = [...new Set(sources.map((s) => s.publisher))];
  const shown = publishers.slice(0, 2).join(' · ');
  const more = publishers.length > 2 ? ` and ${publishers.length - 2} more` : '';
  return `Data: ${shown}${more} · checked ${checkedOn}`;
}

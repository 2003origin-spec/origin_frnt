/**
 * Rank Predictor → college finder hand-off (plan §11.4 "inputs pre-filled from
 * the predictor"). The predicted ranges and the student's details are kept in
 * this tab's sessionStorage only, read once by /rank-predictor/colleges, then
 * deleted. Never sent anywhere but the search itself (plan §12.1).
 */

import { INDIAN_STATES } from '@/lib/constants';
import { COUNSELLING_CATEGORIES, type CounsellingCategory, type CounsellingExam, type CounsellingRanks, type RankRange } from '@/lib/counselling/types';
import type { Prediction, RankCategory } from '@/lib/rank-predictor/types';

const KEY = 'origin:college-finder:handoff';
const MAX_AGE_MS = 30 * 60 * 1000;
const MAX_RANK = 2_500_000;

export type Handoff = {
  exam: CounsellingExam;
  ranks: CounsellingRanks;
  category: CounsellingCategory;
  pwd: boolean;
  homeState: string;
};

function range(band: { low: number; high: number } | null | undefined): RankRange | undefined {
  if (!band) return undefined;
  const low = Math.max(1, Math.round(band.low));
  const high = Math.max(low, Math.round(band.high));
  return high <= MAX_RANK ? { low, high } : undefined;
}

/** The predictor's result → the finder's rank fields. */
export function handoffFromPrediction(p: Prediction, details: { category: RankCategory; pwd: boolean; homeState: string }): Handoff {
  const ranks: CounsellingRanks = {};
  if (p.exam === 'neet') {
    ranks.neetAir = range(p.air);
  } else if (p.exam === 'jee-main') {
    ranks.jeeMainCrl = range(p.air);
    if (details.category !== 'general') ranks.jeeMainCategory = range(p.categoryRank);
    if (details.pwd) ranks.jeeMainPwdCrl = range(p.pwdRank);
  } else {
    ranks.jeeAdvCrl = range(p.air);
    if (details.category !== 'general') ranks.jeeAdvCategory = range(p.categoryRank);
    if (details.pwd) ranks.jeeAdvPwdCrl = range(p.pwdRank);
  }
  for (const k of Object.keys(ranks) as (keyof CounsellingRanks)[]) if (!ranks[k]) delete ranks[k];
  return { exam: p.exam === 'neet' ? 'neet' : 'jee', ranks, category: details.category, pwd: details.pwd, homeState: details.homeState };
}

export function saveHandoff(h: Handoff, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...h, savedAt: now }));
  } catch {
    // Storage blocked: the student types the rank on the finder.
  }
}

const RANK_KEYS: readonly (keyof CounsellingRanks)[] = [
  'jeeAdvCrl',
  'jeeAdvCategory',
  'jeeAdvPwdCrl',
  'jeeAdvPwdCategory',
  'jeeMainCrl',
  'jeeMainCategory',
  'jeeMainPwdCrl',
  'jeeMainPwdCategory',
  'neetAir',
  'neetTnStateRank',
];

function validRange(v: unknown): RankRange | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const { low, high } = v as { low?: unknown; high?: unknown };
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_RANK;
  return ok(low) && ok(high) && low <= high ? { low, high } : undefined;
}

/** Read and delete. Anything malformed or older than 30 minutes is ignored. */
export function takeHandoff(now = Date.now()): Handoff | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Handoff> & { savedAt?: number; ranks?: Record<string, unknown> };
    if (typeof p.savedAt !== 'number' || now - p.savedAt > MAX_AGE_MS || now < p.savedAt) return null;
    if (p.exam !== 'jee' && p.exam !== 'neet') return null;
    if (!p.category || !(COUNSELLING_CATEGORIES as readonly string[]).includes(p.category)) return null;
    const ranks: CounsellingRanks = {};
    for (const k of RANK_KEYS) {
      const r = validRange(p.ranks?.[k]);
      if (r) ranks[k] = r;
    }
    return {
      exam: p.exam,
      ranks,
      category: p.category,
      pwd: p.pwd === true,
      homeState: typeof p.homeState === 'string' && (INDIAN_STATES as string[]).includes(p.homeState) ? p.homeState : '',
    };
  } catch {
    return null;
  }
}

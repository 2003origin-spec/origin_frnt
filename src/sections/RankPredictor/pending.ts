/**
 * Keeps the form across the login round-trip (plan §8.4): saved in this tab's
 * sessionStorage just before the visitor goes to /auth, read back once when
 * the page loads again, then deleted. Never sent to our server, never kept
 * beyond the tab, and dropped after 30 minutes.
 */

import { INDIAN_STATES } from '@/lib/constants';
import { EXAM_SUBJECTS } from '@/lib/rank-predictor/subjects';
import { RANK_CATEGORIES, RANK_PREDICTOR_EXAMS, type RankCategory, type RankPredictorExam } from '@/lib/rank-predictor/types';

const KEY = 'origin:rank-predictor:pending';
const MAX_AGE_MS = 30 * 60 * 1000;

export type PendingForm = {
  exam: RankPredictorExam;
  marks: Record<string, string>;
  category: RankCategory;
  pwd: boolean;
  homeState: string;
  shift: string;
  /** True when the visitor had asked for a prediction (re-run it after login). */
  predict: boolean;
};

export function savePending(form: PendingForm, now = Date.now()): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...form, savedAt: now }));
  } catch {
    // Storage blocked: the visitor just types the marks again.
  }
}

/** Read and delete. Anything malformed or too old is ignored. */
export function takePending(now = Date.now()): PendingForm | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<PendingForm> & { savedAt?: number };
    if (typeof p.savedAt !== 'number' || now - p.savedAt > MAX_AGE_MS || now < p.savedAt) return null;
    if (!p.exam || !(RANK_PREDICTOR_EXAMS as readonly string[]).includes(p.exam)) return null;
    if (!p.category || !(RANK_CATEGORIES as readonly string[]).includes(p.category)) return null;
    const marks: Record<string, string> = {};
    for (const box of EXAM_SUBJECTS[p.exam]) {
      const v = p.marks?.[box.id];
      if (typeof v === 'string' && /^-?\d{1,3}$/.test(v)) marks[box.id] = v;
    }
    return {
      exam: p.exam,
      marks,
      category: p.category,
      pwd: p.pwd === true,
      homeState: typeof p.homeState === 'string' && (INDIAN_STATES as string[]).includes(p.homeState) ? p.homeState : '',
      shift: typeof p.shift === 'string' && /^\d{4}-\d{2}-\d{2}-S[12]$/.test(p.shift) ? p.shift : '',
      predict: p.predict === true,
    };
  } catch {
    return null;
  }
}

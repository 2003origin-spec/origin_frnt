import { FREE_CHECKS_PER_DAY, type Access } from '@/lib/rank-predictor/types';

/** Where the Rank Predictor's login prompts go (plan §8.4): back here after login. */
export const LOGIN_HREF = '/auth?next=%2Frank-predictor';
export const SIGNUP_HREF = '/auth?mode=signup&next=%2Frank-predictor';

export const FREE_CHECKS_LABEL = `${FREE_CHECKS_PER_DAY} free checks`;

/** The line under the Predict button for visitors (plan §8.4), page and landing widget. */
export function freeChecksLine(access: Access | null): string {
  const left = access?.remainingToday;
  if (left === 0) return 'No free checks left today. They come back at 12:00 am IST.';
  if (left === 1) return '1 free check left today';
  return `${FREE_CHECKS_LABEL} today`;
}

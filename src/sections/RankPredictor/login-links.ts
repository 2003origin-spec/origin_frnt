import { FREE_CHECKS_PER_DAY } from '@/lib/rank-predictor/types';

/** Where the Rank Predictor's login prompts go (plan §8.4): back here after login. */
export const LOGIN_HREF = '/auth?next=%2Frank-predictor';
export const SIGNUP_HREF = '/auth?mode=signup&next=%2Frank-predictor';

export const FREE_CHECKS_LABEL = `${FREE_CHECKS_PER_DAY} free checks`;

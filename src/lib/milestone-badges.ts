// Question-milestone badges (separate from the points/rank tiers in badges.ts).
// Earned purely from the student's total questions solved — mirrors the
// getUnlockedBadges pattern in badges.ts. Art: public/badges/milestones/*.png.
import type { User } from '@/types';

export interface MilestoneBadge {
  id: string;
  /** Questions-solved threshold to unlock. */
  solved: number;
  /** Short label shown under the badge (matches the number on the art). */
  label: string;
  /** One-liner shown when earned. */
  tagline: string;
  src: string;
}

export const MILESTONE_BADGES: MilestoneBadge[] = [
  { id: 'q100', solved: 100, label: '100', tagline: 'The journey has begun!', src: '/badges/milestones/q100.png' },
  { id: 'q500', solved: 500, label: '500', tagline: "You're building something great!", src: '/badges/milestones/q500.png' },
  { id: 'q1000', solved: 1000, label: '1K', tagline: "You're on fire — keep going!", src: '/badges/milestones/q1000.png' },
  { id: 'q2000', solved: 2000, label: '2K', tagline: 'Consistency is your superpower!', src: '/badges/milestones/q2000.png' },
  { id: 'q5000', solved: 5000, label: '5K', tagline: "You're not just learning, you're leveling up!", src: '/badges/milestones/q5000.png' },
  { id: 'q10000', solved: 10000, label: '10K', tagline: "You've joined the elite. Legend status unlocked!", src: '/badges/milestones/q10000.png' },
];

/** Total questions solved for a user = sum of daily contribution counts.
 *  Mirrors DailyTracker's totalSolved so the cabinet matches the "N solved" figure. */
export function totalQuestionsSolved(user: Pick<User, 'contributionData'>): number {
  return user.contributionData?.reduce((sum, item) => sum + (item.count || 0), 0) ?? 0;
}

export function getUnlockedMilestones(totalSolved: number): MilestoneBadge[] {
  return MILESTONE_BADGES.filter((m) => totalSolved >= m.solved);
}

export function getLockedMilestones(totalSolved: number): MilestoneBadge[] {
  return MILESTONE_BADGES.filter((m) => totalSolved < m.solved);
}

/** The next badge the student is working toward, or null once all are earned. */
export function getNextMilestone(totalSolved: number): MilestoneBadge | null {
  return MILESTONE_BADGES.find((m) => totalSolved < m.solved) ?? null;
}

// Streak milestone badges — earned by reaching a day-streak length.
// Art: public/badges/streaks/s{7,30,100,365}.png.
export interface StreakBadge {
  id: string;
  days: number;
  label: string;
  title: string;
  src: string;
}

export const STREAK_BADGES: StreakBadge[] = [
  { id: 's7', days: 7, label: '7', title: 'One Week Warrior', src: '/badges/streaks/s7.png' },
  { id: 's30', days: 30, label: '30', title: 'Monthly Machine', src: '/badges/streaks/s30.png' },
  { id: 's100', days: 100, label: '100', title: 'Century Club', src: '/badges/streaks/s100.png' },
  { id: 's365', days: 365, label: '365', title: 'Unstoppable', src: '/badges/streaks/s365.png' },
];

/** Next streak badge to work toward given the best streak reached, or null. */
export function getNextStreakBadge(bestStreak: number): StreakBadge | null {
  return STREAK_BADGES.find((b) => bestStreak < b.days) ?? null;
}

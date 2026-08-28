/**
 * Login-driven daily streak (Phase 2). Records a login as "active today" and
 * decides whether the first-login-of-the-day flame celebration should fire.
 *
 * Thin I/O wrapper around the pure `touchLoginStreak` transition in
 * `gamification.ts`: it loads the store, applies the touch, and persists only
 * the `streaks` collection (+ the denormalised `user.streak` mirror) for this
 * user — the same scoped hot-path write the practice-submit flow uses, so cost
 * doesn't grow with database size. Safe to call on every dashboard load; the
 * `celebrate` flag is server-authoritative and fires at most once per IST day.
 */

import { withStoreAsyncScoped } from "@/server/store";
import { touchLoginStreak, type StreakTouchResult } from "@/server/gamification";

export type { StreakTouchResult } from "@/server/gamification";

export async function recordDailyLoginStreak(userId: string): Promise<StreakTouchResult | null> {
  return withStoreAsyncScoped(
    (store) => touchLoginStreak(store, userId),
    { userId, collections: ["streaks"], persistUser: true },
  );
}

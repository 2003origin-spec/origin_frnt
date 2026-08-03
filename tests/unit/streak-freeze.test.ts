import test from "node:test";
import assert from "node:assert/strict";

import { updateUserStreak, FREEZES_PER_MONTH } from "../../src/server/gamification";

// IST calendar day offset from today (matches gamification's +5:30 bucketing).
function istDay(offsetDays: number): string {
  return new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}
const thisMonth = istDay(0).slice(0, 7);

function makeStore(streak: Record<string, unknown>) {
  return {
    streaks: [{ userId: "u1", longestStreak: 0, weeklyData: [], freezeMonth: thisMonth, ...streak }],
    users: [{ id: "u1", streak: 0 }],
    dailyActivities: [],
  } as any;
}

test("consecutive day increments the streak", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-1), freezesRemaining: 2 });
  assert.equal(updateUserStreak(store, "u1"), 6);
});

test("same IST day is idempotent", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(0), freezesRemaining: 2 });
  assert.equal(updateUserStreak(store, "u1"), 5);
});

test("one missed day is bridged by a freeze — streak survives, freeze consumed", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-2), freezesRemaining: 2 });
  assert.equal(updateUserStreak(store, "u1"), 6);
  assert.equal(store.streaks[0].freezesRemaining, 1);
});

test("missed days beyond the freeze budget reset the streak", () => {
  const store = makeStore({ currentStreak: 9, lastStudyDate: istDay(-3), freezesRemaining: 1 }); // 2 missed > 1 freeze
  assert.equal(updateUserStreak(store, "u1"), 1);
  assert.equal(store.streaks[0].freezesRemaining, 1); // untouched — not enough to bridge
});

test("freeze allowance replenishes on a new month", () => {
  const store = makeStore({ currentStreak: 3, lastStudyDate: istDay(-2), freezesRemaining: 0, freezeMonth: "2000-01" });
  updateUserStreak(store, "u1");
  // Month rolled over → freezes reset to the monthly cap, then one is spent bridging the gap.
  assert.equal(store.streaks[0].freezesRemaining, FREEZES_PER_MONTH - 1);
});

test("first-ever activity starts the streak at 1", () => {
  const store = makeStore({ currentStreak: 0, lastStudyDate: null, freezesRemaining: 2 });
  assert.equal(updateUserStreak(store, "u1"), 1);
});

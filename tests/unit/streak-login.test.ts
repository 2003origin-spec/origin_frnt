/**
 * Phase 1 unit tests — login-driven streak touch + first-login-of-the-day
 * celebration signal (touchLoginStreak). Pure store mutation, no DB.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { touchLoginStreak, updateUserStreak } from "../../src/server/gamification";

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

test("first login of the day increments and celebrates", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-1), freezesRemaining: 2, lastCelebratedDate: istDay(-1) });
  const r = touchLoginStreak(store, "u1");
  assert.equal(r?.event, "increased");
  assert.equal(r?.previous, 5);
  assert.equal(r?.current, 6);
  assert.equal(r?.celebrate, true);
  assert.equal(store.streaks[0].lastCelebratedDate, istDay(0));
});

test("second login the same day does not celebrate again", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-1), freezesRemaining: 2, lastCelebratedDate: istDay(-1) });
  touchLoginStreak(store, "u1"); // first: celebrates, stamps today
  const r = touchLoginStreak(store, "u1"); // second: same day
  assert.equal(r?.event, "same");
  assert.equal(r?.current, 6);
  assert.equal(r?.celebrate, false);
});

test("broken streak resets to 1 and celebrates the reset", () => {
  const store = makeStore({ currentStreak: 9, lastStudyDate: istDay(-3), freezesRemaining: 1, lastCelebratedDate: istDay(-3) }); // 2 missed > 1 freeze
  const r = touchLoginStreak(store, "u1");
  assert.equal(r?.event, "reset");
  assert.equal(r?.previous, 9);
  assert.equal(r?.current, 1);
  assert.equal(r?.celebrate, true);
});

test("missed day bridged by a freeze counts as an increase", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-2), freezesRemaining: 2, lastCelebratedDate: istDay(-2) });
  const r = touchLoginStreak(store, "u1");
  assert.equal(r?.event, "increased");
  assert.equal(r?.current, 6);
  assert.equal(store.streaks[0].freezesRemaining, 1);
  assert.equal(r?.celebrate, true);
});

test("studied earlier today, then first login → gentle welcome (same) still celebrates once", () => {
  // lastStudyDate already today (study path ran first), but celebration not yet shown.
  const store = makeStore({ currentStreak: 6, lastStudyDate: istDay(0), freezesRemaining: 2, lastCelebratedDate: null });
  const r = touchLoginStreak(store, "u1");
  assert.equal(r?.event, "same");
  assert.equal(r?.current, 6);
  assert.equal(r?.celebrate, true);
  assert.equal(store.streaks[0].lastCelebratedDate, istDay(0));
});

test("first-ever login starts the streak at 1 and celebrates", () => {
  const store = makeStore({ currentStreak: 0, lastStudyDate: null, freezesRemaining: 2, lastCelebratedDate: null });
  const r = touchLoginStreak(store, "u1");
  assert.equal(r?.event, "first");
  assert.equal(r?.current, 1);
  assert.equal(r?.celebrate, true);
});

test("missing user row yields null (no crash)", () => {
  const store = { streaks: [], users: [], dailyActivities: [] } as any;
  assert.equal(touchLoginStreak(store, "ghost"), null);
});

test("regression: updateUserStreak still returns the number on a consecutive day", () => {
  const store = makeStore({ currentStreak: 5, lastStudyDate: istDay(-1), freezesRemaining: 2 });
  assert.equal(updateUserStreak(store, "u1"), 6);
});

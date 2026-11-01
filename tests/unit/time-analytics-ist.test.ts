/**
 * The 7-day study-time window (buildTimeAnalytics) is keyed by IST day, like
 * the activities it reads. With a UTC "today", 00:00-05:30 IST showed today's
 * bar as 0 and yesterday's time as today.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildTimeAnalytics } from "../../src/server/gamification";

test("the last day of the window is today in IST, even before 05:30 IST", (t) => {
  // 01/11/2026 20:00 UTC = 02/11/2026 01:30 IST.
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-01T20:00:00Z") });
  const store = {
    dailyActivities: [{ userId: "u1", date: "2026-11-02", webpageTime: 120, practiceTime: 60, pomodoroTime: 0 }],
  } as any;
  const week = buildTimeAnalytics(store, "u1");
  assert.equal(week.length, 7);
  assert.equal(week[6].date, "2026-11-02");
  assert.equal(week[6].webpageTime, 120);
  assert.equal(week[0].date, "2026-10-27");
});

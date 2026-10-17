import assert from "node:assert/strict";
import test from "node:test";

import {
  addDays,
  coverLevel,
  earnsEveningBonus,
  istDay,
  rosterDays,
  rosterEditBlock,
  shiftEnd,
  shiftMinutes,
  weekdayOf,
} from "../../src/server/now/roster-rules";

// Monday to Saturday, 6–10 pm IST; Sunday closed.
const hours = { from: "18:00", to: "22:00", days: [1, 2, 3, 4, 5, 6] };
const at = (iso: string) => new Date(iso);

test("IST days, weekdays and day arithmetic", () => {
  assert.equal(istDay(Date.parse("2026-10-17T19:00:00Z")), "2026-10-18", "00:30 IST is the next day");
  assert.equal(weekdayOf("2026-10-18"), 0, "18/10/2026 is a Sunday");
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
});

test("the roster is today plus 13 days, closed days marked, today locks at shift start", () => {
  const before = rosterDays(at("2026-10-17T10:00:00+05:30"), hours);
  assert.equal(before.length, 14);
  assert.equal(before[0].day, "2026-10-17");
  assert.equal(before[13].day, "2026-10-30");
  assert.deepEqual(before[0], { day: "2026-10-17", weekday: 6, open: true, editable: true });
  assert.deepEqual(before[1], { day: "2026-10-18", weekday: 0, open: false, editable: false }, "Sunday is closed");
  const during = rosterDays(at("2026-10-17T18:00:00+05:30"), hours);
  assert.equal(during[0].editable, false, "the shift has started");
  assert.equal(during[2].editable, true, "Monday is still open to change");
});

test("a slot can only be changed for an open, future-or-not-started evening within 14 days", () => {
  const now = at("2026-10-17T10:00:00+05:30");
  assert.equal(rosterEditBlock("2026-10-17", now, hours), null);
  assert.equal(rosterEditBlock("2026-10-30", now, hours), null);
  assert.match(rosterEditBlock("2026-10-16", now, hours)!, /passed/);
  assert.match(rosterEditBlock("2026-10-31", now, hours)!, /14 days/);
  assert.match(rosterEditBlock("2026-10-18", now, hours)!, /closed/);
  assert.match(rosterEditBlock("2026-10-17", at("2026-10-17T18:05:00+05:30"), hours)!, /started/);
  assert.match(rosterEditBlock("17-10-2026", now, hours)!, /valid/);
});

test("with no open hours every day is closed", () => {
  assert.ok(rosterDays(at("2026-10-17T10:00:00+05:30"), { from: "18:00", to: "18:00", days: [0, 1, 2, 3, 4, 5, 6] }).every((d) => !d.open));
});

test("cover: none, thin under two, ok from two", () => {
  assert.equal(coverLevel(0), "none");
  assert.equal(coverLevel(1), "thin");
  assert.equal(coverLevel(2), "ok");
});

test("shift length and end, including a window past midnight", () => {
  assert.equal(shiftMinutes(hours), 240);
  assert.equal(shiftMinutes({ from: "22:00", to: "02:00", days: [] }), 240);
  assert.equal(shiftMinutes({ from: "18:00", to: "18:00", days: [] }), 0);
  assert.equal(shiftEnd("2026-10-17", hours).toISOString(), "2026-10-17T16:30:00.000Z", "10 pm IST");
  assert.equal(shiftEnd("2026-10-17", { from: "22:00", to: "02:00", days: [] }).toISOString(), "2026-10-17T20:30:00.000Z", "2 am IST next day");
});

test("evening bonus: enough of the shift online, and rostered unless that rule is off", () => {
  const base = { shiftMinutes: 240, rostered: true, minOnlinePercent: 90, requireRoster: true };
  assert.equal(earnsEveningBonus({ ...base, onlineMinutes: 216 }), true, "exactly 90%");
  assert.equal(earnsEveningBonus({ ...base, onlineMinutes: 215 }), false);
  assert.equal(earnsEveningBonus({ ...base, onlineMinutes: 240, rostered: false }), false, "not on the roster");
  assert.equal(earnsEveningBonus({ ...base, onlineMinutes: 240, rostered: false, requireRoster: false }), true);
  assert.equal(earnsEveningBonus({ ...base, onlineMinutes: 0, shiftMinutes: 0 }), false, "no shift, no bonus");
});

test("impossible days are refused, not rolled into the next month (review fix)", () => {
  const feb = at("2027-02-20T10:00:00+05:30");
  assert.match(rosterEditBlock("2027-02-30", feb, hours)!, /valid/);
  assert.match(rosterEditBlock("2027-02-31", feb, hours)!, /valid/);
  assert.equal(rosterEditBlock("2027-02-22", feb, hours), null);
});

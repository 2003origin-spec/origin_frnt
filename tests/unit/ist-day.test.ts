import test from "node:test";
import assert from "node:assert/strict";

import {
  IST_OFFSET_MS,
  istDateKey,
  istDateKeyFromMs,
  istEpochDay,
  istEpochDayFromMs,
} from "../../src/lib/ist-day";

const utc = (iso: string) => Date.parse(iso);

test("IST is UTC+5:30", () => {
  assert.equal(IST_OFFSET_MS, 19_800_000);
});

test("the day key flips at 18:30 UTC, not at 00:00 UTC", () => {
  // This is the whole point of the module: the old code used
  // new Date().toISOString().slice(0,10), which rolls over at 05:30 IST.
  assert.equal(istDateKeyFromMs(utc("2026-08-19T18:29:59.999Z")), "2026-08-19");
  assert.equal(istDateKeyFromMs(utc("2026-08-19T18:30:00.000Z")), "2026-08-20");
});

test("midnight UTC is still the previous IST day's evening", () => {
  // 00:00 UTC = 05:30 IST on the SAME date, so the key must not have advanced
  // past it — the UTC-keyed code would have rolled the card over here.
  assert.equal(istDateKeyFromMs(utc("2026-08-20T00:00:00Z")), "2026-08-20");
  assert.equal(istDateKeyFromMs(utc("2026-08-19T23:59:59Z")), "2026-08-20");
});

test("accepts a Date or epoch millis, and defaults to now", () => {
  const ms = utc("2026-01-01T12:00:00Z");
  assert.equal(istDateKey(new Date(ms)), istDateKey(ms));
  assert.match(istDateKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test("year and month boundaries land on the IST side", () => {
  assert.equal(istDateKeyFromMs(utc("2025-12-31T18:30:00Z")), "2026-01-01");
  assert.equal(istDateKeyFromMs(utc("2026-01-31T18:30:00Z")), "2026-02-01");
});

test("the epoch day advances at the same instant as the date key", () => {
  const before = utc("2026-08-19T18:29:59.999Z");
  const after = utc("2026-08-19T18:30:00.000Z");
  assert.equal(istEpochDayFromMs(after) - istEpochDayFromMs(before), 1);
  assert.notEqual(istDateKeyFromMs(before), istDateKeyFromMs(after));
});

test("the epoch day is constant across one IST day and +1 across two", () => {
  const dayStart = utc("2026-08-19T18:30:00Z"); // 00:00 IST on the 20th
  const dayEnd = utc("2026-08-20T18:29:59Z"); // 23:59:59 IST on the 20th
  assert.equal(istEpochDayFromMs(dayStart), istEpochDayFromMs(dayEnd));
  assert.equal(istEpochDayFromMs(dayEnd + 1000) - istEpochDayFromMs(dayStart), 1);
});

test("istEpochDay accepts a Date or epoch millis", () => {
  const ms = utc("2026-08-19T12:00:00Z");
  assert.equal(istEpochDay(new Date(ms)), istEpochDayFromMs(ms));
  assert.equal(istEpochDay(ms), istEpochDayFromMs(ms));
});

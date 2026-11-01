import test from "node:test";
import assert from "node:assert/strict";

import { isoTimestamp } from "../src/legacy/analytics-store";

// DPP plans, DPP attempts and test results used String(date), which sends
// "Sat Oct 24 2026 20:19:40 GMT+0530 (India Standard Time)". Clients need ISO.

test("dates from Postgres go out as ISO", () => {
  assert.equal(isoTimestamp(new Date("2026-10-24T14:49:40.000Z")), "2026-10-24T14:49:40.000Z");
});

test("strings pass through and missing values are empty", () => {
  assert.equal(isoTimestamp("2026-10-24T14:49:40Z"), "2026-10-24T14:49:40Z");
  assert.equal(isoTimestamp(null), "");
  assert.equal(isoTimestamp(undefined), "");
  assert.equal(isoTimestamp(new Date("nope")), "");
});

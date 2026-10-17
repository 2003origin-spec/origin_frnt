import assert from "node:assert/strict";
import test from "node:test";

import { dayKeyToDMY, dmyToDayKey, formatISTDateTimeDMY, formatISTDayDMY } from "../../src/lib/format-time";

test("dates read dd/mm/yyyy and times are IST whatever the machine's zone", () => {
  // 20:00 UTC is 01:30 the next day in IST.
  assert.equal(formatISTDayDMY("2026-10-17T20:00:00Z"), "18/10/2026");
  assert.equal(formatISTDateTimeDMY("2026-10-17T11:00:00Z"), "17/10/2026, 4:30 pm IST");
  assert.equal(formatISTDateTimeDMY("2026-10-17T20:00:00Z"), "18/10/2026, 1:30 am IST");
  assert.equal(formatISTDayDMY("not a date"), "—");
});

test("day keys convert both ways and impossible dates are refused", () => {
  assert.equal(dayKeyToDMY("2026-10-05"), "05/10/2026");
  assert.equal(dmyToDayKey("05/10/2026"), "2026-10-05");
  assert.equal(dmyToDayKey(" 29/02/2028 "), "2028-02-29");
  assert.equal(dmyToDayKey("29/02/2027"), null);
  assert.equal(dmyToDayKey("31/04/2026"), null);
  assert.equal(dmyToDayKey("10/2026"), null);
  assert.equal(dmyToDayKey("2026-10-05"), null);
});

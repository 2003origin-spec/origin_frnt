import test from "node:test";
import assert from "node:assert/strict";

import { istLocalToUtcIso, utcIsoToIstLocal, formatIST } from "@/lib/contest/ist";

test("istLocalToUtcIso: IST wall time → UTC (subtracts 5:30)", () => {
  // 30 Aug 2026 13:30 IST == 08:00 UTC
  assert.equal(istLocalToUtcIso("2026-08-30T13:30"), "2026-08-30T08:00:00.000Z");
  // midnight IST == previous day 18:30 UTC
  assert.equal(istLocalToUtcIso("2026-08-30T00:00"), "2026-08-29T18:30:00.000Z");
});

test("utcIsoToIstLocal: UTC → IST datetime-local (adds 5:30)", () => {
  assert.equal(utcIsoToIstLocal("2026-08-30T08:00:00.000Z"), "2026-08-30T13:30");
  assert.equal(utcIsoToIstLocal("2026-08-29T18:30:00.000Z"), "2026-08-30T00:00");
});

test("round-trips both directions", () => {
  const local = "2026-12-01T09:15";
  assert.equal(utcIsoToIstLocal(istLocalToUtcIso(local)!), local);
  const iso = "2026-01-15T03:45:00.000Z";
  assert.equal(istLocalToUtcIso(utcIsoToIstLocal(iso)), iso);
});

test("blank / malformed inputs are safe", () => {
  assert.equal(istLocalToUtcIso(""), null);
  assert.equal(istLocalToUtcIso("not-a-date"), null);
  assert.equal(istLocalToUtcIso(null), null);
  assert.equal(utcIsoToIstLocal(""), "");
  assert.equal(utcIsoToIstLocal("garbage"), "");
});

test("formatIST renders an IST-suffixed string, '—' for empty", () => {
  assert.equal(formatIST(null), "—");
  const s = formatIST("2026-08-30T08:00:00.000Z");
  assert.match(s, /IST$/);
  assert.match(s, /2026/);
  assert.match(s, /1:30/); // 08:00 UTC == 1:30 PM IST
});

import test from "node:test";
import assert from "node:assert/strict";

import { acceptTimeText } from "@/lib/now-format";
import { ageInYears, decideAccess, isMinorOn } from "@/server/now/now-access";
import {
  DEFAULT_NOW_SETTINGS,
  isWithinOpenHours,
  parseBotRule,
  parseFeatures,
  parseOpenHours,
  parseQuiz,
  parseTransfers,
  prepareSettingsUpdate,
} from "@/server/now/now-settings";

// 2026-10-16 is a Friday. 18:30 IST = 13:00 UTC.
const istAt = (hhmm: string, day = "2026-10-16") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.parse(`${day}T00:00:00Z`) + (h * 60 + m - 330) * 60_000);
};

test("open hours are evaluated in IST", () => {
  const hours = { from: "18:00", to: "22:00", days: [5] };
  assert.equal(isWithinOpenHours(hours, istAt("18:30")), true);
  assert.equal(isWithinOpenHours(hours, istAt("17:59")), false);
  assert.equal(isWithinOpenHours(hours, istAt("22:00")), false);
  assert.equal(isWithinOpenHours(hours, istAt("19:00", "2026-10-17")), false, "Saturday is not listed");
});

test("a window that crosses midnight belongs to the day it opened", () => {
  const hours = { from: "22:00", to: "02:00", days: [5] };
  assert.equal(isWithinOpenHours(hours, istAt("23:00")), true);
  assert.equal(isWithinOpenHours(hours, istAt("01:00", "2026-10-17")), true, "Friday night into Saturday");
  assert.equal(isWithinOpenHours(hours, istAt("01:00", "2026-10-16")), false, "Thursday night is not open");
});

test("malformed stored settings fall back to defaults instead of breaking", () => {
  assert.deepEqual(parseOpenHours("{not json"), DEFAULT_NOW_SETTINGS.openHours);
  assert.deepEqual(parseOpenHours(JSON.stringify({ from: "25:00", to: "22:00", days: [1] })), DEFAULT_NOW_SETTINGS.openHours);
  assert.deepEqual(parseBotRule(null), DEFAULT_NOW_SETTINGS.bot);
  assert.equal(parseBotRule(JSON.stringify({ enabled: false })).enabled, false);
  assert.equal(parseBotRule(JSON.stringify({ afterMs: null })).afterMs, null);
  assert.equal(parseTransfers(JSON.stringify({ enabled: "yes" })).enabled, false);
  assert.equal(parseQuiz(JSON.stringify({ passPercent: 500 })).passPercent, DEFAULT_NOW_SETTINGS.quiz.passPercent);
});

test("coin transfers ship switched off", () => {
  assert.equal(DEFAULT_NOW_SETTINGS.transfers.enabled, false);
});

test("an admin settings update is validated before anything is saved", () => {
  const bad = prepareSettingsUpdate({ commissionBps: 20_000, welcomeCoins: -1 });
  assert.equal(bad.ok, false);
  const good = prepareSettingsUpdate({ commissionBps: 1_500, openHours: { from: "18:00", to: "22:00", days: [1, 2] } });
  assert.ok(good.ok);
  if (good.ok) {
    assert.deepEqual(good.pairs.map(([k]) => k).sort(), ["now_commission_bps", "now_open_hours"]);
  }
});

test("age is whole years and a missing date of birth counts as a minor", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  assert.equal(ageInYears(new Date("2008-10-16T00:00:00Z"), now), 18);
  assert.equal(ageInYears(new Date("2008-10-17T00:00:00Z"), now), 17);
  assert.equal(isMinorOn(null, now), true);
  assert.equal(isMinorOn(new Date("2000-01-01T00:00:00Z"), now), false);
});

test("access needs the flag, a pilot invite, and guardian consent for minors", () => {
  const base = { enabled: true, inCohort: true, isMinor: false, hasStudentConsent: false };
  assert.deepEqual(decideAccess(base), { canRequest: true, blockedReason: null });
  assert.equal(decideAccess({ ...base, enabled: false }).blockedReason, "flag_off");
  assert.equal(decideAccess({ ...base, inCohort: false }).blockedReason, "not_invited");
  assert.equal(decideAccess({ ...base, isMinor: true }).blockedReason, "needs_guardian_consent");
  assert.equal(decideAccess({ ...base, isMinor: true, hasStudentConsent: true }).canRequest, true);
});

test("extra parts (B89–B95) are off by default and only `true` switches one on", () => {
  const d = DEFAULT_NOW_SETTINGS;
  assert.deepEqual(d.features, { board: false, askLater: false, groups: false, merch: false, rupeePrices: false });
  assert.deepEqual(parseFeatures(null), d.features);
  assert.deepEqual(parseFeatures("{oops"), d.features);
  assert.deepEqual(parseFeatures(JSON.stringify({ board: true, merch: "yes", hack: true })), { ...d.features, board: true });
  const saved = prepareSettingsUpdate({ features: { ...d.features, groups: true } });
  assert.ok(saved.ok);
  assert.deepEqual(saved.pairs, [["now_features", JSON.stringify({ ...d.features, groups: true })]]);
});

test("accept time reads as rounded plain text (B90)", () => {
  assert.equal(acceptTimeText(null), null);
  assert.equal(acceptTimeText(0), "accepts in about 5 s");
  assert.equal(acceptTimeText(13), "accepts in about 15 s");
  assert.equal(acceptTimeText(56), "accepts in about 55 s");
  assert.equal(acceptTimeText(59), "accepts in about 1 min");
  assert.equal(acceptTimeText(150), "accepts in about 3 min");
  assert.equal(acceptTimeText(-1), null);
});

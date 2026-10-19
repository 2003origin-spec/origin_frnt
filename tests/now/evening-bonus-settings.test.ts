import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_NOW_SETTINGS, parseEveningBonus, prepareSettingsUpdate } from "../../src/server/now/now-settings";

test("the evening bonus is off by default and never on with zero coins", () => {
  assert.deepEqual(DEFAULT_NOW_SETTINGS.eveningBonus, { enabled: false, coins: 0, minOnlinePercent: 90, requireRoster: true });
  assert.equal(parseEveningBonus(null).enabled, false);
  assert.equal(parseEveningBonus(JSON.stringify({ enabled: true, coins: 0 })).enabled, false);
  assert.deepEqual(parseEveningBonus(JSON.stringify({ enabled: true, coins: 25, minOnlinePercent: 80, requireRoster: false })), {
    enabled: true,
    coins: 25,
    minOnlinePercent: 80,
    requireRoster: false,
  });
  assert.equal(parseEveningBonus(JSON.stringify({ enabled: true, coins: 25, minOnlinePercent: 0 })).minOnlinePercent, 90, "bad share falls back");
});

test("an admin cannot switch the bonus on without an amount", () => {
  const refused = prepareSettingsUpdate({ eveningBonus: { enabled: true, coins: 0, minOnlinePercent: 90, requireRoster: true } });
  assert.equal(refused.ok, false);
  const saved = prepareSettingsUpdate({ eveningBonus: { enabled: true, coins: 30, minOnlinePercent: 90, requireRoster: true } });
  assert.ok(saved.ok);
  assert.deepEqual(saved.pairs, [["now_evening_bonus", JSON.stringify({ enabled: true, coins: 30, minOnlinePercent: 90, requireRoster: true })]]);
});

test("out-of-range bonus values are refused, not silently reset (review fix)", () => {
  for (const bonus of [
    { enabled: true, coins: 150_000, minOnlinePercent: 90, requireRoster: true },
    { enabled: true, coins: 25, minOnlinePercent: 0, requireRoster: true },
    { enabled: false, coins: 25, minOnlinePercent: 150, requireRoster: true },
    { enabled: false, coins: 2.5, minOnlinePercent: 90, requireRoster: true },
  ]) {
    const result = prepareSettingsUpdate({ eveningBonus: bonus });
    assert.equal(result.ok, false, JSON.stringify(bonus));
  }
});

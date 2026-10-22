import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PRICE_TABLE,
  checkExtension,
  holdAdjustmentForFallback,
  lookupPrice,
  repriceForRequeue,
  sessionLengthMinutes,
  splitSessionPrice,
  validatePriceTable,
} from "@/server/now/pricing";
import { normalizeDifficulty } from "@/server/now/types";

test("the default table covers every difficulty for both solver kinds", () => {
  assert.deepEqual(validatePriceTable(DEFAULT_PRICE_TABLE), []);
  assert.equal(DEFAULT_PRICE_TABLE.length, 8);
});

test("a table missing a row or with bad numbers is refused", () => {
  const missing = DEFAULT_PRICE_TABLE.filter((r) => !(r.difficulty === "insane" && r.solverKind === "bot"));
  assert.ok(validatePriceTable(missing).some((e) => e.includes("insane:bot")));
  const bad = DEFAULT_PRICE_TABLE.map((r) => (r.difficulty === "easy" ? { ...r, priceCoins: 0, minutes: 0.5 } : r));
  const errors = validatePriceTable(bad);
  assert.ok(errors.some((e) => e.includes("price")));
  assert.ok(errors.some((e) => e.includes("session length")));
});

test("duplicate rows are refused", () => {
  const dup = [...DEFAULT_PRICE_TABLE, DEFAULT_PRICE_TABLE[0]];
  assert.ok(validatePriceTable(dup).some((e) => e.startsWith("Duplicate")));
});

test("OGCode's free-text difficulty maps onto the four price keys", () => {
  assert.equal(normalizeDifficulty(" Insane "), "insane");
  assert.equal(normalizeDifficulty("EASY"), "easy");
  assert.equal(normalizeDifficulty("very hard"), null);
  assert.equal(normalizeDifficulty(undefined), null);
});

test("lookup finds the row for difficulty and solver kind", () => {
  const row = lookupPrice(DEFAULT_PRICE_TABLE, "hard", "bot");
  assert.ok(row);
  assert.equal(row?.solverKind, "bot");
  assert.equal(lookupPrice([], "hard", "bot"), null);
});

test("commission is rounded down so the solver never loses a coin to rounding", () => {
  assert.deepEqual(splitSessionPrice(99, 1_000), { solver: 90, platform: 9 });
  assert.deepEqual(splitSessionPrice(7, 1_500), { solver: 6, platform: 1 });
  assert.deepEqual(splitSessionPrice(60, 0), { solver: 60, platform: 0 });
  assert.throws(() => splitSessionPrice(60, 10_001));
  assert.throws(() => splitSessionPrice(1.5, 100));
});

test("extensions are refused at the cap and when the balance is too low", () => {
  const row = { ...DEFAULT_PRICE_TABLE[0], extensionCoins: 20, extensionMinutes: 2, maxExtensions: 2 };
  assert.deepEqual(checkExtension(row, 0, 100), { ok: true, coins: 20, minutes: 2 });
  assert.deepEqual(checkExtension(row, 2, 100), { ok: false, reason: "max_reached" });
  assert.deepEqual(checkExtension(row, 1, 19), { ok: false, reason: "insufficient_coins" });
  assert.equal(sessionLengthMinutes(row, 2), row.minutes + 4);
});

test("falling back to a bot at a different price moves the hold by the difference", () => {
  assert.equal(holdAdjustmentForFallback(60, 60), 0);
  assert.equal(holdAdjustmentForFallback(60, 40), -20);
  assert.equal(holdAdjustmentForFallback(40, 60), 20);
});

test("NOW-4: a bot no-show requeue re-prices to the human price; a human no-show keeps its price", () => {
  // Bot (40) failed to show; a human (60) will pick it up: hold 20 more.
  assert.deepEqual(repriceForRequeue(40, "bot", 60), { priceCoins: 60, holdDelta: 20 });
  // A dearer bot gives the difference back.
  assert.deepEqual(repriceForRequeue(80, "bot", 60), { priceCoins: 60, holdDelta: -20 });
  assert.deepEqual(repriceForRequeue(60, "bot", 60), { priceCoins: 60, holdDelta: 0 });
  assert.equal(repriceForRequeue(60, "human", 60), null);
});

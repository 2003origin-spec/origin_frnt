/**
 * ORBIT Glicko-2 unit tests (Phase 7). Covers seed/provisional, tiers, the
 * directionality of a win vs a loss, RD shrinking as you play, cold-start
 * bounded deltas, and the small-field swing cap.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ORBIT_DEFAULT_RATING,
  ORBIT_DEFAULT_RD,
  SMALL_FIELD_MAX_SWING,
  applyContest,
  isProvisional,
  orbitTier,
  seedRating,
} from "@/lib/contest/glicko2";

const bigField = (score: number) => ({
  fieldMeanRating: 1000,
  fieldMeanRd: 200,
  score,
  fieldSize: 500,
});

test("seed rating is 1000 / RD 350 and provisional", () => {
  const s = seedRating();
  assert.equal(s.rating, ORBIT_DEFAULT_RATING);
  assert.equal(s.rd, ORBIT_DEFAULT_RD);
  assert.equal(isProvisional(s.rd), true);
});

test("tiers map at the boundaries", () => {
  assert.equal(orbitTier(0), "Explorer");
  assert.equal(orbitTier(799), "Explorer");
  assert.equal(orbitTier(800), "Challenger");
  assert.equal(orbitTier(1000), "Contender");
  assert.equal(orbitTier(1399), "Advanced");
  assert.equal(orbitTier(1600), "Elite");
  assert.equal(orbitTier(2500), "Origin Legend");
});

test("winning (high percentile) raises the rating; losing lowers it", () => {
  const s = seedRating();
  const won = applyContest(s, bigField(0.95)); // top of the field
  const lost = applyContest(s, bigField(0.05)); // bottom
  assert.ok(won.rating > s.rating, `won ${won.rating} > ${s.rating}`);
  assert.ok(lost.rating < s.rating, `lost ${lost.rating} < ${s.rating}`);
});

test("RD shrinks after a contest (uncertainty drops as you play)", () => {
  const s = seedRating();
  const after = applyContest(s, bigField(0.5));
  assert.ok(after.rd < s.rd, `rd ${after.rd} < ${s.rd}`);
});

test("provisional (high RD) becomes established after enough contests", () => {
  let s = seedRating();
  for (let i = 0; i < 3; i += 1) s = applyContest(s, bigField(0.6));
  assert.equal(isProvisional(s.rd), false, `rd ${s.rd} should be established`);
});

test("cold-start: an all-provisional first contest yields bounded, sane deltas", () => {
  // everyone at the seed; the field mean is the seed too
  const s = seedRating();
  const outcome = { fieldMeanRating: 1000, fieldMeanRd: 350, score: 0.99, fieldSize: 1000 };
  const after = applyContest(s, outcome);
  // a top finish moves up, but not absurdly in one provisional contest
  assert.ok(after.rating > s.rating);
  assert.ok(after.rating - s.rating < 400, `delta ${after.rating - s.rating} bounded`);
});

test("small-field guardrail caps the swing", () => {
  const s = seedRating();
  const tiny = { fieldMeanRating: 1000, fieldMeanRd: 350, score: 0.99, fieldSize: 3 };
  const after = applyContest(s, tiny);
  assert.ok(Math.abs(after.rating - s.rating) <= SMALL_FIELD_MAX_SWING + 0.001, `swing ${after.rating - s.rating}`);
});

test("RD never exceeds the seed", () => {
  const s = { rating: 1000, rd: ORBIT_DEFAULT_RD, volatility: 0.06 };
  const after = applyContest(s, bigField(0.5));
  assert.ok(after.rd <= ORBIT_DEFAULT_RD);
});

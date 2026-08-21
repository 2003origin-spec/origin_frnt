/**
 * Contest gamification unit tests (Phase 8): badge rules, streak progression,
 * milestones, personal-best merge.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  badgesForResult,
  mergePersonalBests,
  nextStreak,
  streakMilestoneHit,
  type ResultForBadges,
} from "@/lib/contest/gamification";

const base: ResultForBadges = {
  rank: 500,
  percentile: 50,
  totalRanked: 1000,
  correct: 5,
  incorrect: 3,
  timeVsMedian: 1,
  orbitAfter: 1100,
  orbitChange: 5,
};

test("top_1_percent needs a big field and top-1% finish", () => {
  assert.ok(badgesForResult({ ...base, percentile: 99.5, rank: 3 }).includes("top_1_percent"));
  // small field never earns it
  assert.ok(!badgesForResult({ ...base, totalRanked: 20, percentile: 100, rank: 1 }).includes("top_1_percent"));
});

test("speedster needs to be fast AND near the top", () => {
  assert.ok(badgesForResult({ ...base, timeVsMedian: 0.6, rank: 100 }).includes("speedster"));
  // fast but mid-pack → no
  assert.ok(!badgesForResult({ ...base, timeVsMedian: 0.6, rank: 800 }).includes("speedster"));
});

test("sharpshooter = many correct, zero wrong", () => {
  assert.ok(badgesForResult({ ...base, correct: 12, incorrect: 0 }).includes("sharpshooter"));
  assert.ok(!badgesForResult({ ...base, correct: 12, incorrect: 1 }).includes("sharpshooter"));
});

test("comeback on a big ORBIT jump; origin_legend at 2000+", () => {
  assert.ok(badgesForResult({ ...base, orbitChange: 60 }).includes("comeback"));
  assert.ok(badgesForResult({ ...base, orbitAfter: 2050 }).includes("origin_legend"));
  assert.ok(!badgesForResult({ ...base, orbitAfter: 1999 }).includes("origin_legend"));
});

test("streak grows on consecutive participation, resets on a gap", () => {
  assert.equal(nextStreak(4, true), 5);
  assert.equal(nextStreak(4, false), 1);
  assert.equal(nextStreak(0, true), 2);
});

test("streak milestones fire only at 3/5/10/25/50", () => {
  assert.equal(streakMilestoneHit(5), 5);
  assert.equal(streakMilestoneHit(4), null);
  assert.equal(streakMilestoneHit(50), 50);
});

test("personal bests take the better of each metric", () => {
  const pb = mergePersonalBests(
    { highestOrbit: 1200, bestRank: 10, bestPercentile: 90 },
    { orbitAfter: 1150, rank: 4, percentile: 95 },
  );
  assert.equal(pb.highestOrbit, 1200); // kept (higher)
  assert.equal(pb.bestRank, 4); // improved (lower)
  assert.equal(pb.bestPercentile, 95); // improved (higher)
});

test("first personal best seeds from the result", () => {
  const pb = mergePersonalBests(
    { highestOrbit: null, bestRank: null, bestPercentile: null },
    { orbitAfter: 1100, rank: 7, percentile: 88 },
  );
  assert.deepEqual(pb, { highestOrbit: 1100, bestRank: 7, bestPercentile: 88 });
});

/**
 * §9 time-bucket index: floor(tt / 5), clamped to [0, 120] (600s+ overflow).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ogcodeTimeBucketIndex } from "@/server/ogcode-catalog";

test("bucketing: floor(tt/5)", () => {
  assert.equal(ogcodeTimeBucketIndex(0), 0);
  assert.equal(ogcodeTimeBucketIndex(4), 0);
  assert.equal(ogcodeTimeBucketIndex(5), 1);
  assert.equal(ogcodeTimeBucketIndex(9), 1);
  assert.equal(ogcodeTimeBucketIndex(60), 12);
});

test("bucketing: clamps at the 600s overflow bucket (120)", () => {
  assert.equal(ogcodeTimeBucketIndex(600), 120);
  assert.equal(ogcodeTimeBucketIndex(5000), 120);
});

test("bucketing: guards NaN/negative to 0", () => {
  assert.equal(ogcodeTimeBucketIndex(NaN), 0);
  assert.equal(ogcodeTimeBucketIndex(-10), 0);
});

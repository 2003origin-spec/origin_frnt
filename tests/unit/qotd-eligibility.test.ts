import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_CLASS_BANDS,
  bandClasses,
  bandIncludesUnclassified,
  eligibleClassBand,
  eligibleQuestionClasses,
} from "../../src/lib/qotd-eligibility";

const SENIOR = bandClasses("senior");
const JUNIOR = bandClasses("junior");

test("11, 12 and dropper are all senior band", () => {
  for (const value of ["11", "12", "dropper"]) {
    assert.deepEqual(eligibleQuestionClasses(value), SENIOR, value);
  }
});

test("9 and 10 are junior band", () => {
  assert.deepEqual(eligibleQuestionClasses("9"), JUNIOR);
  assert.deepEqual(eligibleQuestionClasses("10"), JUNIOR);
});

test("an unset class falls back to the senior band", () => {
  // origin_users.student_class is nullable and frequently unset; every student
  // on an 11-12-only product is senior band. Defaulting the other way would
  // blank the feature for most of the live base.
  assert.deepEqual(eligibleQuestionClasses(null), SENIOR);
  assert.deepEqual(eligibleQuestionClasses(undefined), SENIOR);
  assert.deepEqual(eligibleQuestionClasses(""), SENIOR);
});

test("free-text values are normalised before matching", () => {
  // The column is TEXT written from signup and profile edits.
  assert.deepEqual(eligibleQuestionClasses(" 10 "), JUNIOR);
  assert.deepEqual(eligibleQuestionClasses("Dropper"), SENIOR);
  assert.deepEqual(eligibleQuestionClasses("DROPPER"), SENIOR);
});

test("unrecognised junk is senior band, never a crash", () => {
  for (const value of ["13", "b.tech", "class 11", "🙂"]) {
    assert.deepEqual(eligibleQuestionClasses(value), SENIOR, value);
  }
});

test("only the senior band claims unclassified rows", () => {
  // Any untagged row in today's bank is 11-12 content, so the senior band takes
  // them. Letting them into the junior band would hand a class-9 student
  // class-11 physics - the exact conflict the mapping exists to prevent.
  assert.equal(bandIncludesUnclassified("senior"), true);
  assert.equal(bandIncludesUnclassified("junior"), false);
});

test("band names are derived from the student class, not from class arrays", () => {
  // The band is a STORAGE KEY. Deriving it by comparing class arrays would let
  // an inline [9, 10] read as "senior" and file junior draws in the senior bag.
  assert.equal(eligibleClassBand("12"), "senior");
  assert.equal(eligibleClassBand("dropper"), "senior");
  assert.equal(eligibleClassBand(null), "senior");
  assert.equal(eligibleClassBand("9"), "junior");
  assert.equal(eligibleClassBand(" 10 "), "junior");
});

test("every band is enumerated and has classes", () => {
  assert.deepEqual([...ALL_CLASS_BANDS], ["senior", "junior"]);
  for (const band of ALL_CLASS_BANDS) {
    assert.ok(bandClasses(band).length > 0, band);
  }
});

test("bands hold the classes their names imply", () => {
  assert.deepEqual([...SENIOR], [11, 12]);
  assert.deepEqual([...JUNIOR], [9, 10]);
});

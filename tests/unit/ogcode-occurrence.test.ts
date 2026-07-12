/**
 * Exam-family canonicalization for OGCode occurrence facet chips.
 * The bank stores year/variant-suffixed values ("JEE (2020)", "JEE Main",
 * "NEET (2019)", "JEE / NEET"); the filter chips collapse them into families.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { canonicalOccurrenceFamilies } from "@/server/ogcode-catalog";

test("year/variant-suffixed values collapse into their exam family", () => {
  assert.deepEqual(canonicalOccurrenceFamilies("JEE (2020)"), ["JEE"]);
  assert.deepEqual(canonicalOccurrenceFamilies("JEE Main"), ["JEE"]);
  assert.deepEqual(canonicalOccurrenceFamilies("JEE Main (NA)"), ["JEE"]);
  assert.deepEqual(canonicalOccurrenceFamilies("JEE Advanced (2022)"), ["JEE"]);
  assert.deepEqual(canonicalOccurrenceFamilies("JEE (Advanced) 2021"), ["JEE"]);
  assert.deepEqual(canonicalOccurrenceFamilies("NEET (2019)"), ["NEET"]);
  assert.deepEqual(canonicalOccurrenceFamilies("AIPMT"), ["AIPMT"]);
});

test("combined values belong to every family they mention", () => {
  assert.deepEqual(canonicalOccurrenceFamilies("JEE / NEET"), ["JEE", "NEET"]);
  assert.deepEqual(canonicalOccurrenceFamilies("NEET / JEE"), ["JEE", "NEET"]);
});

test("NA drops out; unrecognized exams pass through with the (...) suffix stripped", () => {
  assert.deepEqual(canonicalOccurrenceFamilies("NA"), []);
  assert.deepEqual(canonicalOccurrenceFamilies("BITSAT (2024)"), ["BITSAT"]);
  assert.deepEqual(canonicalOccurrenceFamilies("KVPY"), ["KVPY"]);
});

/**
 * Indian mobile validation unit tests. The load-bearing case: all-same-digit
 * fakes like 6666666666 (which the old /^[6-9]\d{9}$/ regex accepted) are now
 * rejected, while real numbers and +91-prefixed inputs still pass.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/mobile";

test("rejects all-same-digit fakes", () => {
  for (const fake of ["6666666666", "7777777777", "8888888888", "9999999999"]) {
    assert.equal(isValidIndianMobile(fake), false, `${fake} should be rejected`);
  }
});

test("accepts plausible real numbers", () => {
  for (const ok of ["9876543211", "6123456789", "7000012345", "8987654321"]) {
    assert.equal(isValidIndianMobile(ok), true, `${ok} should be accepted`);
  }
});

test("rejects wrong format (short, long, starts 0-5)", () => {
  for (const bad of ["123456789", "12345678901", "5987654321", "0987654321", "", "abcdefghij"]) {
    assert.equal(isValidIndianMobile(bad), false, `${bad} should be rejected`);
  }
});

test("normalizes +91 / spaces / punctuation to the 10-digit local", () => {
  assert.equal(normalizeIndianMobile("+91 98765 43211"), "9876543211");
  assert.equal(normalizeIndianMobile("919876543211"), "9876543211");
  assert.equal(normalizeIndianMobile("98765-43211"), "9876543211");
  // a +91-prefixed all-same-digit is still a fake
  assert.equal(normalizeIndianMobile("+916666666666"), null);
});

test("null/undefined input is invalid, not a throw", () => {
  assert.equal(isValidIndianMobile(null), false);
  assert.equal(isValidIndianMobile(undefined), false);
});

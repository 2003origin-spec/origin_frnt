import test from "node:test";
import assert from "node:assert/strict";

import { subjectFilterNames } from "../src/server/workspaces/marketplace-store";

// Institute Browse filters: teachers type subjects freely, so filters ignore case and alias maths.

test("subject filters ignore case and spacing", () => {
  assert.deepEqual(subjectFilterNames(" Physics "), ["physics"]);
  assert.deepEqual(subjectFilterNames("BIOLOGY"), ["biology"]);
});

test("maths, math and mathematics are one subject", () => {
  for (const name of ["mathematics", "Maths", "math"]) {
    assert.deepEqual(subjectFilterNames(name), ["mathematics", "maths", "math"]);
  }
});

test("no subject means no filter", () => {
  assert.deepEqual(subjectFilterNames(undefined), []);
  assert.deepEqual(subjectFilterNames("   "), []);
});

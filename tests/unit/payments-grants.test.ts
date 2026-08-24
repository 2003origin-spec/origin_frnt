import test from "node:test";
import assert from "node:assert/strict";

import { paidTermExpiry } from "../../src/server/payments/grants";

test("paidTermExpiry starts at now when an existing grant is expired", () => {
  const now = new Date("2026-08-22T00:00:00.000Z");
  assert.equal(
    paidTermExpiry(new Date("2026-07-01T00:00:00.000Z"), 1, now).toISOString(),
    "2026-09-22T00:00:00.000Z",
  );
});

test("paidTermExpiry extends from the later existing expiry", () => {
  const now = new Date("2026-08-22T00:00:00.000Z");
  assert.equal(
    paidTermExpiry(new Date("2026-12-15T12:30:00.000Z"), 3, now).toISOString(),
    "2027-03-15T12:30:00.000Z",
  );
});

test("paidTermExpiry uses calendar months and clamps month-end dates", () => {
  const now = new Date("2026-01-31T10:00:00.000Z");
  assert.equal(
    paidTermExpiry(null, 1, now).toISOString(),
    "2026-02-28T10:00:00.000Z",
  );
  assert.equal(
    paidTermExpiry(null, 12, now).toISOString(),
    "2027-01-31T10:00:00.000Z",
  );
});

test("paidTermExpiry rejects invalid terms", () => {
  assert.throws(() => paidTermExpiry(null, 0), /positive integer/);
  assert.throws(() => paidTermExpiry(null, 1.5), /positive integer/);
});


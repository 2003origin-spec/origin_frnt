import test from "node:test";
import assert from "node:assert/strict";

import { planFromFlags } from "../../src/server/premium-access-admin-store";

// The admin roster labels each student by WHY they are premium so a real Razorpay
// payer is never confused with an admin-granted comp. Priority: paid > comp >
// teacher > free. A payer who also holds a comp grant must still read as "paid"
// (the toggle protects paid users), and a comp holder must read as "comp" even
// if they also hold a teacher grant.
test("planFromFlags resolves plan label by priority paid > comp > teacher > free", () => {
  assert.equal(planFromFlags({ has_paid: true, has_comp: true, has_teacher: true }), "paid");
  assert.equal(planFromFlags({ has_paid: false, has_comp: true, has_teacher: true }), "comp");
  assert.equal(planFromFlags({ has_paid: false, has_comp: false, has_teacher: true }), "teacher");
  assert.equal(planFromFlags({ has_paid: false, has_comp: false, has_teacher: false }), "free");
  // A comp grant does not mask a paid subscription — paid wins.
  assert.equal(planFromFlags({ has_paid: true, has_comp: false, has_teacher: false }), "paid");
});

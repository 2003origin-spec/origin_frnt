/** Phase 5 pricing contract checks that do not require a live Postgres pool. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = readFileSync(new URL("../../src/server/pricing/pricing-service.ts", import.meta.url), "utf8");
const publicRoute = readFileSync(new URL("../../src/app/api/pricing/route.ts", import.meta.url), "utf8");
const couponValidationRoute = readFileSync(
  new URL("../../src/app/api/payments/coupon/validate/route.ts", import.meta.url),
  "utf8",
);
const adminRoute = readFileSync(new URL("../../src/app/api/admin/pricing/route.ts", import.meta.url), "utf8");
const adminPanel = readFileSync(new URL("../../src/components/admin/AdminPricingPanel.tsx", import.meta.url), "utf8");
const premium = readFileSync(new URL("../../src/sections/Premium.tsx", import.meta.url), "utf8");
const subscriptions = readFileSync(new URL("../../src/server/subscriptions/subscriptions-service.ts", import.meta.url), "utf8");
const coupons = readFileSync(new URL("../../src/server/pricing/coupons-service.ts", import.meta.url), "utf8");
const orders = readFileSync(new URL("../../src/server/payments/orders-service.ts", import.meta.url), "utf8");
const checkoutRoute = readFileSync(new URL("../../src/app/api/payments/checkout/route.ts", import.meta.url), "utf8");
const orderCheckout = readFileSync(new URL("../../src/components/payments/OrderCheckout.tsx", import.meta.url), "utf8");
const adminCouponsPanel = readFileSync(new URL("../../src/components/admin/AdminCouponsPanel.tsx", import.meta.url), "utf8");

test("pricing service exposes the complete cached snapshot contract", () => {
  assert.match(service, /getCachedPricing\(loadPublicPricing\)/);
  assert.match(service, /listAmountMinor/);
  assert.match(service, /getTermOptions/);
  assert.match(service, /currency: "INR"/);
  assert.match(service, /invalidatePricingCache\(\)/);
});

test("public pricing route is rate-limited and payments-gated", () => {
  assert.match(publicRoute, /requireFeatureEnabled\("payments"\)/);
  assert.match(publicRoute, /checkRateLimit\(generalLimiter/);
  assert.match(publicRoute, /getPublicPricing\(\)/);
});

test("coupon preview resolves server pricing and never reserves a redemption", () => {
  assert.match(couponValidationRoute, /requireFeatureEnabled\("payments"\)/);
  assert.match(couponValidationRoute, /requireRole\(request, \["student"\]\)/);
  assert.match(couponValidationRoute, /paymentsCouponLimiter/);
  assert.match(couponValidationRoute, /paymentsCouponFailureLimiter/);
  assert.match(couponValidationRoute, /resolveOrderAmount\(/);
  assert.match(couponValidationRoute, /validateCoupon\(/);
  assert.doesNotMatch(couponValidationRoute, /reserveCoupon\(/);
});

test("Rail-A coupon redemption honors the admin coupon kill switch", () => {
  assert.match(checkoutRoute, /isFeatureEnabled\("adminCoupons"\)/);
  assert.match(orders, /requireFeatureEnabled\("adminCoupons"\)/);
  assert.match(premium, /couponsEnabled/);
});

test("bundle subjects are deduplicated before capture grants", () => {
  assert.match(orders, /new Set\(bundle\.subjects/);
  assert.match(orders, /new Set\(order\.notes\.bundle_subjects/);
  assert.match(adminRoute, /new Set\(subjects\)/);
});

test("coupon date input preserves the selected local day", () => {
  assert.match(adminCouponsPanel, /endOfLocalDayIso/);
  assert.match(adminCouponsPanel, /23, 59, 59, 999/);
});

test("Rail-A checkout previews coupon-adjusted display amounts", () => {
  assert.match(orderCheckout, /validatePaymentCoupon/);
  assert.match(orderCheckout, /couponPreviewMinor/);
});

test("admin pricing route supports MRP and term lifecycle operations", () => {
  assert.match(adminRoute, /listAmountMinor/);
  assert.match(adminRoute, /kind: z\.literal\("term"\)/);
  assert.match(adminRoute, /upsertTermOption/);
  assert.match(adminRoute, /export async function DELETE/);
  assert.match(adminRoute, /deactivateTermOption/);
});

test("admin pricing panel renders editable MRP and term-ladder controls", () => {
  assert.match(adminPanel, /Display MRP/);
  assert.match(adminPanel, /Term ladder/);
  assert.match(adminPanel, /saveTerm/);
  assert.match(adminPanel, /deactivateTerm/);
});

test("premium renders MRP plus one Rail-A checkout per subject/bundle term", () => {
  assert.match(premium, /getPublicPaymentPricing/);
  assert.match(premium, /line-through/);
  assert.match(premium, /activeTerms\.map/);
  assert.match(premium, /kind="subject_term"/);
  assert.match(premium, /kind="bundle_term"/);
  assert.match(premium, /bundleId=\{pricing\.bundle\?\.id\}/);
});

test("subscription coupons use the reusable plan cache and reserve before gateway creation", () => {
  assert.match(service, /getOrCreateMonthlyPlan/);
  assert.match(service, /pricing\.razorpay_plans/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(subscriptions, /getOrCreateMonthlyPlan/);
  assert.match(subscriptions, /reserveCoupon/);
  assert.match(subscriptions, /releaseCouponReservation/);
  assert.match(subscriptions, /rebindCouponReservation/);
  assert.ok(
    subscriptions.indexOf("reserveCoupon({") < subscriptions.indexOf("client.subscriptions.create({"),
    "coupon reservation must occur before the Razorpay subscription call",
  );
  // The invariant is about the DISCOUNTED plan specifically. `createSubjectSubscription`
  // also resolves a BASE plan earlier (lazily, when an admin saved the price with no
  // Razorpay credentials configured), so matching the first `getOrCreateMonthlyPlan({`
  // would pin the wrong call. Anchor on the coupon-tagged plan instead.
  const discountedPlanAt = subscriptions.indexOf('origin_kind: "subject_coupon"');
  assert.ok(discountedPlanAt > -1, "the discounted plan must be tagged origin_kind: subject_coupon");
  assert.ok(
    subscriptions.indexOf("reserveCoupon({") < discountedPlanAt,
    "coupon reservation must occur before creating a discounted plan",
  );
});

test("coupon admin writes invalidate the public pricing cache", () => {
  assert.match(coupons, /invalidatePricingCache/);
  assert.match(coupons, /setCouponActive[\s\S]*invalidatePricingCache/);
});

test("coupon lifecycle is locked, guarded, and coupled to Rail-A terminal transitions", () => {
  assert.match(coupons, /SELECT \* FROM pricing\.coupons WHERE code = \$1 FOR UPDATE/);
  assert.match(coupons, /times_redeemed < max_redemptions/);
  assert.match(coupons, /state = 'reserved'/);
  assert.match(coupons, /state = 'committed'/);
  assert.match(coupons, /state = 'released'/);
  assert.match(coupons, /expires_at <= NOW\(\)/);
  assert.match(coupons, /allowLegacyWithoutIdentity/);
  assert.match(orders, /commitCouponReservation/);
  assert.match(orders, /releaseCouponReservation/);
  assert.match(orders, /Coupon settlement failed/);
});

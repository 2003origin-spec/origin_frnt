/**
 * GA privacy rule (owner, non-negotiable): never send marks, ranks, percentile,
 * category, PwD, gender or home state. These tests fail if a forbidden key or
 * a number/free-text value can reach GA.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { assertSafeAnalyticsParams, createEventTracker, UnsafeAnalyticsParamsError, type AnalyticsParams } from "@/lib/analytics-events";

const FORBIDDEN_KEYS = [
  "marks",
  "total_marks",
  "physicsMarks",
  "score",
  "rank",
  "air",
  "crl",
  "category_rank",
  "jeeMainRank",
  "percentile",
  "category",
  "pwd",
  "is_pwbd",
  "gender",
  "home_state",
  "homeState",
  "state",
  "email",
];

test("every forbidden key is rejected", () => {
  for (const key of FORBIDDEN_KEYS) {
    assert.throws(() => assertSafeAnalyticsParams({ exam: "neet", [key]: "x" }), UnsafeAnalyticsParamsError, key);
  }
});

test("keys outside the allow-list are rejected even if they look harmless", () => {
  assert.throws(() => assertSafeAnalyticsParams({ value: "x" }), UnsafeAnalyticsParamsError);
  assert.throws(() => assertSafeAnalyticsParams({ result: "x" }), UnsafeAnalyticsParamsError);
});

test("numbers and free text are rejected as values (no rank or state can slip through)", () => {
  assert.throws(() => assertSafeAnalyticsParams({ exam: 1234 }), UnsafeAnalyticsParamsError);
  assert.throws(() => assertSafeAnalyticsParams({ source: "Tamil Nadu" }), UnsafeAnalyticsParamsError);
  assert.throws(() => assertSafeAnalyticsParams({ placement: "AIR 1,234" }), UnsafeAnalyticsParamsError);
  assert.throws(() => assertSafeAnalyticsParams({ exam: { rank: 1 } }), UnsafeAnalyticsParamsError);
});

test("coarse values pass", () => {
  assert.doesNotThrow(() =>
    assertSafeAnalyticsParams({ exam: "jee-advanced", signed_in: "no", placement: "landing", source: "college_teaser", action: "sign_up", platform: "ios" }),
  );
});

test("the tracker drops an unsafe event and never calls GA with it", () => {
  const sent: [string, AnalyticsParams][] = [];
  const rejected: Error[] = [];
  const trackEvent = createEventTracker((e, p) => sent.push([e, p]), (err) => rejected.push(err));

  trackEvent("rank_predictor_submit", { exam: "neet", signed_in: "yes", placement: "page" });
  // Simulate a future careless call that bypasses the types.
  (trackEvent as (e: string, p: Record<string, unknown>) => void)("rank_predictor_result", { exam: "neet", rank: 1200, marks: 650 });
  (trackEvent as (e: string, p: Record<string, unknown>) => void)("college_finder_search", { exam: "jee", home_state: "Bihar" });

  assert.deepEqual(sent, [["rank_predictor_submit", { exam: "neet", signed_in: "yes", placement: "page" }]]);
  assert.equal(rejected.length, 2);
});

test("optional params left undefined are not sent", () => {
  const sent: AnalyticsParams[] = [];
  const trackEvent = createEventTracker((_e, p) => sent.push(p));
  trackEvent("auth_cta_click", { action: "log_in", source: "college_teaser", placement: undefined });
  assert.deepEqual(sent, [{ action: "log_in", source: "college_teaser" }]);
});

test("app-download events: the new placements and actions pass, still with no personal data", () => {
  const sent: AnalyticsParams[] = [];
  const trackEvent = createEventTracker((_e, p) => sent.push(p));
  for (const placement of ["landing_section", "landing_pill", "landing_nav", "app_more"] as const) {
    for (const action of ["open_sheet", "tab_android", "tab_ios", "play_store", "copy_link"] as const) {
      trackEvent("app_download_click", { platform: "desktop", placement, action });
    }
  }
  assert.equal(sent.length, 20);
  for (const p of sent) assert.deepEqual(Object.keys(p).sort(), ["action", "placement", "platform"]);
});

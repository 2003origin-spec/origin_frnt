/**
 * Home (dashboard) entry to the Rank Predictor: which links show for which
 * switches. The section itself is checked in the browser.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { rankPredictorHomeLinks } from "@/components/dashboard/rank-predictor-home-model";

test("home entry: nothing while the rankPredictor switch is off", () => {
  assert.deepEqual(rankPredictorHomeLinks({ rankPredictor: false, collegeCounselling: false }), []);
  // The college finder page needs both switches, so its link never shows alone.
  assert.deepEqual(rankPredictorHomeLinks({ rankPredictor: false, collegeCounselling: true }), []);
});

test("home entry: predictor only", () => {
  const links = rankPredictorHomeLinks({ rankPredictor: true, collegeCounselling: false });
  assert.deepEqual(links.map((l) => [l.id, l.href]), [["predictor", "/rank-predictor"]]);
});

test("home entry: predictor first, then the college finder", () => {
  const links = rankPredictorHomeLinks({ rankPredictor: true, collegeCounselling: true });
  assert.deepEqual(links.map((l) => [l.id, l.href]), [
    ["predictor", "/rank-predictor"],
    ["colleges", "/rank-predictor/colleges"],
  ]);
  for (const link of links) {
    assert.ok(link.title.length > 0 && link.blurb.length > 0);
  }
});

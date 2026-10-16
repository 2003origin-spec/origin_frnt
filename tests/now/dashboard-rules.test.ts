import test from "node:test";
import assert from "node:assert/strict";

import { topThreeShare } from "@/server/now/admin-insights-service";
import { reviewWarnings } from "@/server/now/dashboard-service";

test("concentration: share of coins from the top three students", () => {
  assert.equal(topThreeShare([]), 0);
  assert.equal(topThreeShare([100]), 1);
  assert.equal(topThreeShare([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]), 0.3);
  assert.equal(topThreeShare([50, 20, 10, 10, 10]), 0.8);
});

test("standing warns one step before an automatic-review limit", () => {
  assert.deepEqual(reviewWarnings({ recentStars: [5, 5, 5, 5, 5], notResolvedToday: 0, reportsIn30Days: 0 }), []);
  assert.equal(reviewWarnings({ recentStars: [], notResolvedToday: 1, reportsIn30Days: 0 })[0].limit, "not_resolved");
  assert.equal(reviewWarnings({ recentStars: [], notResolvedToday: 0, reportsIn30Days: 1 })[0].limit, "reports");
  assert.equal(reviewWarnings({ recentStars: [3, 4, 3, 4], notResolvedToday: 0, reportsIn30Days: 0 })[0].limit, "rating");
});

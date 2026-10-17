import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateScorecard,
  median,
  parseScorecardPeriod,
  repeatUse,
  type ScorecardInput,
} from "../../src/server/now/pilot-scorecard-rules";

const MIN = 60_000;

/** A pilot that meets every pass line with a big enough sample. */
function passing(overrides: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    inHoursRequests: 100,
    inHoursHumanWithin10: 85,
    connectTimesMs: [2 * MIN, 3 * MIN, 3.5 * MIN],
    offersClosed: 100,
    offersAccepted: 70,
    humanCallMinutes: 500,
    onlineMinutes: 1000,
    humanAccepted: 100,
    helperNoShows: 2,
    outcomes: { resolved: 70, partial: 25, unresolved: 5 },
    ratings: 50,
    starsTotal: 225,
    notSolvedTags: 2,
    firstHalfStudents: 50,
    firstHalfReturned: 25,
    resolvedDoubts: 70,
    botCallMinutes: 120,
    upheldChildSafety: 0,
    upheldAbuse: 0,
    liveSessions: 320,
    evenings: 12,
    ...overrides,
  };
}

const statusOf = (input: ScorecardInput, key: string) => evaluateScorecard(input).rows.find((r) => r.key === key)!.status;

test("a pilot meeting every pass line with a big enough sample passes", () => {
  const card = evaluateScorecard(passing());
  assert.equal(card.sample.ready, true);
  assert.equal(card.passed, true);
  assert.deepEqual(
    card.rows.filter((r) => r.status !== "pass").map((r) => r.key),
    ["cost_inputs"],
    "only the cost row is an input, never judged",
  );
});

test("the pilot is not judged before 300 sessions over 10 evenings", () => {
  assert.equal(evaluateScorecard(passing({ liveSessions: 299 })).passed, false);
  assert.equal(evaluateScorecard(passing({ evenings: 9 })).sample.ready, false);
  assert.equal(evaluateScorecard(passing({ liveSessions: 300, evenings: 10 })).sample.ready, true);
});

test("each pass line is judged at its boundary", () => {
  assert.equal(statusOf(passing({ inHoursHumanWithin10: 80 }), "connect_within_10"), "pass");
  assert.equal(statusOf(passing({ inHoursHumanWithin10: 79 }), "connect_within_10"), "fail");
  assert.equal(statusOf(passing({ connectTimesMs: [4 * MIN] }), "median_connect"), "fail", "4 minutes is not under 4");
  assert.equal(statusOf(passing({ offersAccepted: 60 }), "accept_rate"), "pass");
  assert.equal(statusOf(passing({ offersAccepted: 59 }), "accept_rate"), "fail");
  assert.equal(statusOf(passing({ humanCallMinutes: 399 }), "utilisation"), "fail", "under 40% fails");
  assert.equal(statusOf(passing({ humanCallMinutes: 700 }), "utilisation"), "pass");
  assert.equal(statusOf(passing({ humanCallMinutes: 701 }), "utilisation"), "fail", "over 70% also fails");
  assert.equal(statusOf(passing({ helperNoShows: 5 }), "helper_no_show"), "fail", "5% is not under 5%");
  assert.equal(statusOf(passing({ outcomes: { resolved: 64, partial: 31, unresolved: 5 } }), "resolution"), "fail");
  assert.equal(statusOf(passing({ outcomes: { resolved: 80, partial: 10, unresolved: 10 } }), "resolution"), "fail");
  assert.equal(statusOf(passing({ starsTotal: 209 }), "rating"), "fail", "4.18 stars");
  assert.equal(statusOf(passing({ notSolvedTags: 5 }), "rating"), "fail", "10% not-solved tags");
  assert.equal(statusOf(passing({ firstHalfReturned: 19 }), "repeat_use"), "fail");
  assert.equal(statusOf(passing({ upheldChildSafety: 1 }), "safety"), "fail");
});

test("empty measures read 'no data' and stop the pilot passing", () => {
  const card = evaluateScorecard(passing({ ratings: 0, starsTotal: 0, notSolvedTags: 0, onlineMinutes: 0 }));
  assert.equal(card.rows.find((r) => r.key === "rating")!.status, "no_data");
  assert.equal(card.rows.find((r) => r.key === "utilisation")!.status, "no_data");
  assert.equal(card.passed, false);
});

test("an upheld abuse report is shown but only child safety fails the safety row", () => {
  const row = evaluateScorecard(passing({ upheldAbuse: 2 })).rows.find((r) => r.key === "safety")!;
  assert.equal(row.status, "pass");
  assert.match(row.value, /plus 2 upheld abuse/);
});

test("median handles odd, even and empty lists", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});

test("repeat use counts students who started in the first half and asked again", () => {
  const from = 0;
  const to = 100;
  const result = repeatUse(
    [
      { studentId: "a", createdAtMs: 10 },
      { studentId: "a", createdAtMs: 90 },
      { studentId: "b", createdAtMs: 20 },
      { studentId: "c", createdAtMs: 60 },
      { studentId: "c", createdAtMs: 70 },
    ],
    from,
    to,
  );
  assert.deepEqual(result, { students: 2, returned: 1 }, "c started in the second half, so it is not counted");
});

test("the period is IST calendar days with an inclusive end", () => {
  assert.equal(parseScorecardPeriod(null, null), null);
  const period = parseScorecardPeriod("2026-11-01", "2026-11-10");
  assert.ok(period && !("error" in period));
  assert.equal(period.from.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(period.to.toISOString(), "2026-11-10T18:30:00.000Z");
  assert.ok(period && "from" in period);
  for (const [a, b] of [
    ["2026-11-01", null],
    ["2026-11-10", "2026-11-01"],
    ["01-11-2026", "2026-11-10"],
    ["2025-01-01", "2026-12-31"],
  ] as const) {
    const result = parseScorecardPeriod(a, b);
    assert.ok(result && "error" in result, `${a} → ${b} is refused`);
  }
});

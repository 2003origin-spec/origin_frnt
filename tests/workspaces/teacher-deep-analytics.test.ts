/**
 * Teacher Analytics Deep-Dive — pure-helper coverage.
 * Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md §9
 *
 * Everything here runs without a database on purpose: these are the functions
 * whose output the teacher reads as fact (medians, bands, percentages) and the
 * ones that sanitise client input before it reaches SQL.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  average,
  clampPage,
  clampPageSize,
  DEFAULT_PAGE_SIZE,
  escapeLikePattern,
  formatCount,
  formatDuration,
  formatPercent,
  formatStudyMinutes,
  initialsOf,
  istDateString,
  istDateStrings,
  MAX_PAGE_SIZE,
  median,
  movingAverage,
  normalizeSearchTerm,
  parseSortDirection,
  parseStudentSort,
  scoreBuckets,
  scoreTone,
  truncateLabel,
  weekdayLabel,
} from "../../src/lib/teacher-analytics";
import { summariseBatchLeaderboard } from "../../src/server/workspaces/workspace-analytics-service";
import { isFeatureEnabled } from "../../src/lib/feature-flags";

// ─── Tone bands ───────────────────────────────────────────────────────────────

test("scoreTone bands at 75 and 50, and treats missing data as muted", () => {
  assert.equal(scoreTone(100), "success");
  assert.equal(scoreTone(75), "success");
  assert.equal(scoreTone(74.9), "warning");
  assert.equal(scoreTone(50), "warning");
  assert.equal(scoreTone(49.9), "danger");
  assert.equal(scoreTone(0), "danger");
  // "No attempts" must never be coloured as a failing score.
  assert.equal(scoreTone(null), "muted");
  assert.equal(scoreTone(undefined), "muted");
  assert.equal(scoreTone(Number.NaN), "muted");
});

// ─── Statistics ───────────────────────────────────────────────────────────────

test("median handles odd, even, single, and empty sets", () => {
  assert.equal(median([10, 20, 30]), 20);
  // Even-sized: the two middle values are averaged (ledger #4).
  assert.equal(median([10, 20, 30, 40]), 25);
  assert.equal(median([42]), 42);
  // Empty is null, NOT 0 — 0 would render as "this batch scores 0%".
  assert.equal(median([]), null);
  assert.equal(median([Number.NaN]), null);
});

test("median does not depend on input order", () => {
  assert.equal(median([30, 10, 40, 20]), 25);
});

test("average ignores non-finite values and returns null when empty", () => {
  assert.equal(average([10, 20, 30]), 20);
  assert.equal(average([10, Number.NaN, 20]), 15);
  assert.equal(average([]), null);
});

test("movingAverage seeds from partial windows so the line starts at point one", () => {
  const result = movingAverage([10, 20, 30, 40], 3);
  assert.equal(result[0], 10);
  assert.equal(result[1], 15);
  assert.equal(result[2], 20);
  assert.equal(result[3], 30);
});

// ─── Score buckets ────────────────────────────────────────────────────────────

test("scoreBuckets always returns ten bands and puts 100% in the last one", () => {
  const buckets = scoreBuckets([100]);
  assert.equal(buckets.length, 10);
  assert.equal(buckets[9].count, 1);
  assert.equal(buckets[9].label, "90-100%");
});

test("scoreBuckets assigns boundary values to the higher band", () => {
  const buckets = scoreBuckets([0, 10, 50, 90]);
  assert.equal(buckets[0].count, 1); // 0
  assert.equal(buckets[1].count, 1); // 10 → 10-20%
  assert.equal(buckets[5].count, 1); // 50 → 50-60%
  assert.equal(buckets[9].count, 1); // 90 → 90-100%
});

test("scoreBuckets drops out-of-range values instead of clamping them", () => {
  const buckets = scoreBuckets([-5, 150, Number.NaN, 55]);
  assert.equal(
    buckets.reduce((sum, b) => sum + b.count, 0),
    1,
  );
  assert.equal(buckets[5].count, 1);
});

test("scoreBuckets tones bands by their upper edge", () => {
  const buckets = scoreBuckets([]);
  assert.equal(buckets[4].tone, "danger"); // 40-50%
  assert.equal(buckets[5].tone, "warning"); // 50-60%
  assert.equal(buckets[7].tone, "success"); // 70-80%
});

// ─── Formatting ───────────────────────────────────────────────────────────────

test("formatters render an em-dash rather than a fabricated zero", () => {
  assert.equal(formatPercent(null), "—");
  assert.equal(formatPercent(Number.NaN), "—");
  assert.equal(formatPercent(62.34, 1), "62.3%");
  assert.equal(formatPercent(62.34), "62%");
  assert.equal(formatCount(null), "—");
  assert.equal(formatCount(12.6), "13");
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(-1), "—");
  assert.equal(formatStudyMinutes(null), "—");
});

test("formatDuration switches units at minute and hour boundaries", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(90), "1m");
  assert.equal(formatDuration(3600), "1h");
  assert.equal(formatDuration(5040), "1h 24m");
});

test("formatStudyMinutes reads origin_users.total_study_time as MINUTES", () => {
  assert.equal(formatStudyMinutes(30), "30m");
  assert.equal(formatStudyMinutes(90), "1.5h");
  assert.equal(formatStudyMinutes(1200), "20h");
});

test("truncateLabel and initialsOf stay safe on edge input", () => {
  assert.equal(truncateLabel("Rotational Motion", 10), "Rotationa…");
  assert.equal(truncateLabel("Optics", 10), "Optics");
  assert.equal(initialsOf("Aarav Sharma"), "AS");
  assert.equal(initialsOf("Aarav"), "A");
  assert.equal(initialsOf("   "), "?");
  assert.equal(initialsOf(null), "?");
});

// ─── Search-input sanitisation ────────────────────────────────────────────────

test("escapeLikePattern neutralises wildcards and escapes the backslash first", () => {
  assert.equal(escapeLikePattern("100%"), "100\\%");
  assert.equal(escapeLikePattern("a_b"), "a\\_b");
  // Backslash must be escaped BEFORE the wildcards, or the added escapes get
  // themselves escaped and the pattern stops matching.
  assert.equal(escapeLikePattern("a\\%"), "a\\\\\\%");
});

test("normalizeSearchTerm trims, collapses whitespace, and caps length", () => {
  assert.equal(normalizeSearchTerm("  Aarav   Sharma "), "Aarav Sharma");
  assert.equal(normalizeSearchTerm(null), "");
  assert.equal(normalizeSearchTerm(undefined), "");
  assert.equal(normalizeSearchTerm("x".repeat(500)).length, 100);
});

test("sort keys are whitelisted — arbitrary input can never reach ORDER BY", () => {
  assert.equal(parseStudentSort("meanPercentage"), "meanPercentage");
  assert.equal(parseStudentSort("name"), "name");
  assert.equal(parseStudentSort("; DROP TABLE origin_users;--"), "name");
  assert.equal(parseStudentSort(null), "name");
  assert.equal(parseSortDirection("desc"), "desc");
  assert.equal(parseSortDirection("sideways"), "asc");
  assert.equal(parseSortDirection(null), "asc");
});

test("pagination input is clamped in both directions", () => {
  assert.equal(clampPageSize(null), DEFAULT_PAGE_SIZE);
  assert.equal(clampPageSize("0"), DEFAULT_PAGE_SIZE);
  assert.equal(clampPageSize("-10"), DEFAULT_PAGE_SIZE);
  assert.equal(clampPageSize("abc"), DEFAULT_PAGE_SIZE);
  assert.equal(clampPageSize("50"), 50);
  assert.equal(clampPageSize("100000"), MAX_PAGE_SIZE);
  assert.equal(clampPage(null), 1);
  assert.equal(clampPage("0"), 1);
  assert.equal(clampPage("-3"), 1);
  assert.equal(clampPage("7"), 7);
});

// ─── IST day bucketing ────────────────────────────────────────────────────────

test("istDateStrings returns a dense, ascending window ending today (IST)", () => {
  const days = istDateStrings(7);
  assert.equal(days.length, 7);
  assert.equal(days[6], istDateString());
  for (let i = 1; i < days.length; i += 1) {
    assert.ok(days[i - 1] < days[i], "dates must be strictly ascending");
  }
  assert.deepEqual(istDateStrings(0), []);
});

test("istDateString buckets by IST, not UTC", () => {
  // 2026-08-03T20:00:00Z is already 2026-08-04 in IST (UTC+5:30).
  const lateEveningUtc = Date.parse("2026-08-03T20:00:00Z");
  assert.equal(istDateString(lateEveningUtc), "2026-08-04");
  // …and just before the IST rollover it is still the 3rd.
  assert.equal(istDateString(Date.parse("2026-08-03T18:00:00Z")), "2026-08-03");
});

test("weekdayLabel reads the stored date string without a timezone shift", () => {
  // 2026-08-03 is a Monday.
  assert.equal(weekdayLabel("2026-08-03"), "Mon");
  assert.equal(weekdayLabel("not-a-date"), "");
});

// ─── Batch summary derivation ─────────────────────────────────────────────────

test("summariseBatchLeaderboard derives stats from the leaderboard it is given", () => {
  const summary = summariseBatchLeaderboard(
    [
      { rank: 1, studentId: "a", displayName: "A", meanPercentage: 90, attempts: 4, platformRank: 1 },
      { rank: 2, studentId: "b", displayName: "B", meanPercentage: 60, attempts: 3, platformRank: 2 },
      { rank: 3, studentId: "c", displayName: "C", meanPercentage: 30, attempts: 2, platformRank: 3 },
    ],
    [
      {
        id: "physics-optics",
        topic: "Optics",
        subject: "physics",
        chapter: null,
        accuracy: 0.2,
        attempts: 12,
        severity: "high",
        snapshotAt: "2026-08-03T00:00:00.000Z",
        covered: false,
        students: 3,
        studentsAffected: 3,
      },
      {
        id: "physics-waves",
        topic: "Waves",
        subject: "physics",
        chapter: null,
        accuracy: 0.25,
        attempts: 8,
        severity: "high",
        snapshotAt: "2026-08-03T00:00:00.000Z",
        // Already covered — must not be counted as an outstanding weak topic.
        covered: true,
        students: 3,
        studentsAffected: 2,
      },
    ],
  );

  assert.equal(summary.available, true);
  assert.equal(summary.averagePercentage, 60);
  assert.equal(summary.medianPercentage, 60);
  assert.equal(summary.topPercentage, 90);
  assert.equal(summary.lowestPercentage, 30);
  assert.equal(summary.rankedStudents, 3);
  assert.equal(summary.weakTopics, 1, "covered topics drop out of the weak count");
  assert.equal(
    summary.scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0),
    3,
  );
});

test("summariseBatchLeaderboard reports unavailable for an empty batch", () => {
  const summary = summariseBatchLeaderboard([], []);
  assert.equal(summary.available, false);
  assert.equal(summary.averagePercentage, null);
  assert.equal(summary.medianPercentage, null);
  assert.equal(summary.topPercentage, null);
  assert.equal(summary.lowestPercentage, null);
  assert.equal(summary.rankedStudents, 0);
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

test("teacherDeepAnalytics is a real kill switch", () => {
  const before = process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS;
  try {
    process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS = "0";
    assert.equal(isFeatureEnabled("teacherDeepAnalytics"), false);
    process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS = "1";
    assert.equal(isFeatureEnabled("teacherDeepAnalytics"), true);
    // Default (no override) is on, matching the rest of the launch flags.
    delete process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS;
    assert.equal(isFeatureEnabled("teacherDeepAnalytics"), true);
  } finally {
    if (before === undefined) delete process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS;
    else process.env.TEACHER_LAUNCH_TEACHER_DEEP_ANALYTICS = before;
  }
});

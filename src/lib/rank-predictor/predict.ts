/**
 * Rank Predictor engine — pure functions over the Stage 1 data files.
 * Plan: V1/PERCENTILE_PREDICTOR_PLAN.md §4 (maths), §5 (labels).
 *
 * Honesty rules the engine enforces (V1/percentile-predictor/data/clean/DATA_NOTES.md):
 *  - no interpolation across a missing year or past the end of a table:
 *    values are clamped to the end point and labelled "rough";
 *  - JEE Main 2025/2026 have no real shift tables — the 20 real 2024 shapes
 *    are used and every JEE Main number is at best an "estimate";
 *  - NEET 2024 (weight "low") never feeds the main band;
 *  - NEET marks outside the KEA 2025 curve (113–670) are "rough";
 *  - NEET category rank is always an "estimate" (NTA publishes none);
 *  - JEE Advanced 2026 tables are third-party anchor points (noted);
 *  - NEET state rank only for the 9 states with a real list; JEE: coming soon.
 */

import {
  jeeAdvEligibility,
  jeeAdvListKey,
  jeeAdvQualification,
  jeeAdvQualifiesFor,
  neetQualifying,
} from "./eligibility";
import { categoryLabel, formatIndian, formatPercentileRange, formatRankRange } from "./format";
import { clamp, lookupRange, tableSpan } from "./interpolate";
import { NEET_STATE_LIST_CODE, ntaStateName } from "./states";
import { EXAM_SUBJECTS } from "./subjects";
import { tieBreakNote } from "./tie-break";
import type {
  JeeAdvancedData,
  JeeAdvYear,
  JeeMainData,
  JeeMainShift,
  JeeMainYear,
  NeetData,
  NeetStateList,
  NeetYear,
  NumberRange,
  Pair,
  PercentileBand,
  PredictInput,
  Prediction,
  Quality,
  RankBand,
  RankCategory,
  RankPredictorData,
  SpreadLine,
} from "./types";

// ─── shared helpers ──────────────────────────────────────────────────────────

const QUALITY_ORDER: Quality[] = ["good_estimate", "estimate", "rough"];

export function worstQuality(...qualities: Quality[]): Quality {
  return qualities.reduce((worst, q) => (QUALITY_ORDER.indexOf(q) > QUALITY_ORDER.indexOf(worst) ? q : worst), "good_estimate");
}

/** Plan §4.6: mock-based input widens the marks before lookup. */
export const MOCK_MARGIN: Record<PredictInput["exam"], number> = {
  "jee-main": 10,
  neet: 25,
  "jee-advanced": 12,
};

/** Plan §5 thin-data rule: no table point within this many marks. */
export const THIN_GAP_MARKS = 15;
/** Plan §5 thin-data rule: a category list with fewer points than this. */
export const THIN_LIST_POINTS = 50;
/** JEE Main percentile band half-width when the shift is known (plan §4.2 step 4). */
export const KNOWN_SHIFT_HALF_WIDTH = 0.15;

/** Lowest per-subject JEE Advanced mark accepted (the data has no fixed minimum; see subjects.ts). */
export const JEE_ADV_SUBJECT_MIN = Math.min(...EXAM_SUBJECTS["jee-advanced"].map((b) => b.min));

/** High/low ratio above which a band counts as "not enough data" (plan §5). */
function tooWide(range: NumberRange): boolean {
  return range.low > 0 && range.high / range.low > 3 && range.high - range.low > 1_000;
}

/**
 * A rank band. Thin tables (no point near the marks, or a short list) make it
 * "rough" + "Not enough data for an exact range". A band that is merely wide
 * because past years disagree (NEET 2025 vs 2026) is real data, not thin data:
 * it is capped at "estimate" and the year spread explains it.
 */
function band(range: NumberRange, quality: Quality, extra: Partial<RankBand> = {}): RankBand {
  const low = Math.max(1, Math.round(Math.min(range.low, range.high)));
  const high = Math.max(low, Math.round(Math.max(range.low, range.high)));
  const notEnough = Boolean(extra.notEnoughData);
  const q = notEnough ? "rough" : tooWide({ low, high }) ? worstQuality(quality, "estimate") : quality;
  const { notEnoughData: _drop, ...rest } = extra;
  void _drop;
  return { low, high, quality: q, ...rest, ...(notEnough ? { notEnoughData: true } : {}) };
}

function sumMarks(marks: Record<string, number>, ids: string[]): number {
  return ids.reduce((acc, id) => acc + (marks[id] ?? 0), 0);
}

function marksWindow(total: number, exam: PredictInput["exam"], source: PredictInput["source"], min: number, max: number): NumberRange {
  const mockBased = source?.kind === "attempt" || source?.kind === "avg3";
  const margin = mockBased ? MOCK_MARGIN[exam] : 0;
  return { low: clamp(total - margin, min, max), high: clamp(total + margin, min, max) };
}

function topText(air: RankBand | null): string | null {
  if (!air || air.high > 100) return null;
  return `Top ~${formatIndian(air.high)} in India`;
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

// ─── NEET ────────────────────────────────────────────────────────────────────

const spreadCache = new WeakMap<NeetYear, { lo: Pair[]; hi: Pair[] }>();

function spreadTables(year: NeetYear): { lo: Pair[]; hi: Pair[] } | null {
  if (!year.marksToAirSpread?.length) return null;
  let cached = spreadCache.get(year);
  if (!cached) {
    cached = {
      lo: year.marksToAirSpread.map(([m, first]) => [m, first] as Pair),
      hi: year.marksToAirSpread.map(([m, , last]) => [m, last] as Pair),
    };
    spreadCache.set(year, cached);
  }
  return cached;
}

export type YearAir = { year: number; lo: number; hi: number; clamped: boolean; gap: number };

/**
 * AIR range a NEET total got in one past year. KEA 2025 carries the first and
 * last AIR seen at each mark; NTA 2026 points are cumulative counts (AIR of the
 * last candidate at ≥ marks), so a mark spans AIR(m+1)+1 … AIR(m). Outside the
 * curve: above the top → 1 … AIR(top); below the bottom → AIR(bottom) …
 * everyone who appeared (no extrapolation). Null when the year has no curve.
 */
export function neetAirForYear(year: NeetYear, marks: number): YearAir | null {
  if (!year.marksToAir?.length) return null;
  const spread = spreadTables(year);
  const span = tableSpan(year.marksToAir);
  let lo: number;
  let hi: number;
  let gap: number;
  if (spread) {
    const a = lookupRange(spread.lo, marks);
    const b = lookupRange(spread.hi, marks);
    lo = a.lo;
    hi = b.hi;
    gap = a.nearestGap;
  } else {
    const at = lookupRange(year.marksToAir, marks);
    const next = lookupRange(year.marksToAir, marks + 1);
    hi = at.hi;
    lo = Math.min(hi, next.lo + 1);
    gap = at.nearestGap;
  }
  let clamped = false;
  if (marks > span.max) {
    lo = 1;
    clamped = true;
  } else if (marks < span.min) {
    hi = year.appeared;
    clamped = true;
  }
  return { year: year.year, lo: Math.max(1, lo), hi: Math.max(1, hi), clamped, gap };
}

function airToPercentile(air: number, appeared: number): number {
  return clamp(100 * (1 - air / appeared), 0, 100);
}

function percentileToAir(percentile: number, appeared: number): number {
  return Math.max(1, Math.round((1 - percentile / 100) * appeared));
}

/** The NEET years that feed the main band: normal weight with a curve. */
export function neetCoreYears(data: NeetData): NeetYear[] {
  return data.years.filter((y) => y.weight === "normal" && (y.marksToAir?.length ?? 0) > 0);
}

/** Integral of a category's share of candidates from AIR 1 to `air` (MCC round-1 shares). */
function cumulativeShare(buckets: NonNullable<NeetYear["categoryShareByAir"]>, key: string, air: number): number {
  let count = 0;
  for (const b of buckets) {
    const from = b.airFrom;
    const to = b.airTo ?? Number.POSITIVE_INFINITY;
    if (air < from) break;
    const upto = Math.min(air, to);
    count += (upto - from + 1) * (b.shares[key] ?? 0);
  }
  return count;
}

const NEET_SHARE_KEY: Record<RankCategory, string> = {
  general: "General",
  ews: "EWS",
  "obc-ncl": "OBC",
  sc: "SC",
  st: "ST",
};

/**
 * Category rank estimate for a NEET AIR: the number of same-category candidates
 * ahead, from (a) MCC round-1 allotments by AIR bucket and (b) NTA's share of
 * appeared candidates, per year. Biased both ways, so the result is the span of
 * all estimates (plan §4.3 step 4). Always "estimate".
 */
export function neetCategoryRankRange(years: readonly NeetYear[], category: RankCategory, air: NumberRange): NumberRange | null {
  const key = NEET_SHARE_KEY[category];
  const lows: number[] = [];
  const highs: number[] = [];
  for (const y of years) {
    if (y.categoryShareByAir?.length) {
      lows.push(cumulativeShare(y.categoryShareByAir, key, air.low));
      highs.push(cumulativeShare(y.categoryShareByAir, key, air.high));
    }
    const share = y.categoryShareAppeared?.shares[key];
    if (typeof share === "number") {
      lows.push(air.low * share);
      highs.push(air.high * share);
    }
  }
  if (!lows.length) return null;
  return { low: Math.max(1, Math.min(...lows)), high: Math.max(1, Math.max(...highs)) };
}

/**
 * The proportional state-rank method (AIR × state share of appeared). NOT used
 * for output — the product shows "not available" for states without a list —
 * kept and tested to document its error (Karnataka, AIR 10,000: real 549 vs
 * ≈ 644). NTA's state table includes a "Total" row, so shares are normalised
 * over the real states (the file's raw shares are half the true value).
 */
export function neetProportionalStateRank(year: NeetYear, state: string, air: number): { rank: number; quality: Quality } | null {
  const shares = year.stateShare?.shares;
  if (!shares) return null;
  const name = ntaStateName(state);
  const share = shares[name];
  if (typeof share !== "number") return null;
  const total = Object.entries(shares)
    .filter(([k]) => k !== "Total")
    .reduce((acc, [, v]) => acc + v, 0);
  if (total <= 0) return null;
  return { rank: Math.max(1, Math.round((air * share) / total)), quality: "rough" };
}

export type StateRankResult = { range: NumberRange; quality: Quality; clamped: boolean; list: NeetStateList };

/**
 * State rank from a real state list. "air" lists map the AIR that marks got in
 * the list's own year; "marks" lists (Tamil Nadu: last rank at each mark) map
 * marks directly, a mark spanning rank(m+1)+1 … rank(m).
 */
export function neetStateRankFromList(data: NeetData, code: string, marks: NumberRange): StateRankResult | null {
  const list = data.stateLists[code];
  if (!list?.points?.length) return null;
  const span = tableSpan(list.points);
  const listQuality: Quality = list.quality === "good_estimate" ? "good_estimate" : "estimate";
  if (list.basis === "marks") {
    const atLow = lookupRange(list.points, marks.low);
    const aboveHigh = lookupRange(list.points, marks.high + 1);
    const hi = atLow.hi;
    const lo = Math.min(hi, aboveHigh.lo + 1);
    const clamped = marks.low < span.min || marks.high > span.max;
    return { range: { low: marks.high > span.max ? 1 : lo, high: hi }, quality: listQuality, clamped, list };
  }
  const year = data.years.find((y) => y.year === list.year);
  if (!year) return null;
  const airHigh = neetAirForYear(year, marks.low);
  const airLow = neetAirForYear(year, marks.high);
  if (!airHigh || !airLow) return null;
  const a = lookupRange(list.points, airLow.lo);
  const b = lookupRange(list.points, airHigh.hi);
  const clamped = airLow.clamped || airHigh.clamped || b.clamped === "above" || a.clamped === "above";
  return { range: { low: a.lo, high: b.hi }, quality: listQuality, clamped, list };
}

/** Inverse lookup on an "air" state list: state merit number → AIR (Gujarat closing values, T2.13c). */
export function stateMeritToAir(list: NeetStateList, stateRank: number): number | null {
  if (list.basis !== "air" || !list.points.length) return null;
  const inverted = list.points.map(([air, rank]) => [rank, air] as Pair);
  const r = lookupRange(inverted, stateRank);
  return Math.round((r.lo + r.hi) / 2);
}

export function predictNeet(data: NeetData, input: PredictInput): Prediction {
  const ids = data.subjects.map((s) => s.id);
  const total = sumMarks(input.marks, ids);
  const marksUsed = marksWindow(total, "neet", input.source, data.minMarks, data.maxMarks);
  const notes: string[] = [];
  const spread: SpreadLine[] = [];
  const mockBased = input.source?.kind === "attempt" || input.source?.kind === "avg3";

  for (const y of data.years) {
    if (y.weight !== "normal") {
      notes.push(`${y.year} left out of the range: ${y.reason ?? "abnormal year"}`);
    } else if (!y.marksToAir?.length) {
      notes.push(`${y.year} skipped: no official marks-to-rank table.`);
    }
  }
  const core = neetCoreYears(data);
  const sourceIds: string[] = [];
  let quality: Quality = mockBased ? "estimate" : "good_estimate";
  let percentile: PercentileBand | null = null;
  let air: RankBand | null = null;
  const perYear: { year: number; lo: number; hi: number }[] = [];

  if (core.length) {
    let pctLow = 100;
    let pctHigh = 0;
    let allThin = true;
    let anyClamped = false;
    for (const y of core) {
      const atLow = neetAirForYear(y, marksUsed.low)!;
      const atHigh = neetAirForYear(y, marksUsed.high)!;
      perYear.push({ year: y.year, lo: atHigh.lo, hi: atLow.hi });
      pctLow = Math.min(pctLow, airToPercentile(atLow.hi, y.appeared));
      pctHigh = Math.max(pctHigh, airToPercentile(atHigh.lo, y.appeared));
      if (Math.max(atLow.gap, atHigh.gap) <= THIN_GAP_MARKS) allThin = false;
      anyClamped ||= atLow.clamped || atHigh.clamped;
      if (y.marksToAirSourceId) sourceIds.push(y.marksToAirSourceId);
      if (y.year === 2026) notes.push("2026 was a re-exam after a cancellation; we weight it with 2025, never alone.");
    }
    // KEA 2025 is the dense curve; outside its marks the answer is rough (DATA_NOTES).
    const kea = core.find((y) => (y.marksToAirSpread?.length ?? 0) > 0);
    if (kea?.marksToAir) {
      const span = tableSpan(kea.marksToAir);
      if (marksUsed.low < span.min || marksUsed.high > span.max) {
        quality = "rough";
        notes.push(`Our detailed ${kea.year} data covers ${span.min}–${span.max} marks; outside that the range is rough.`);
      }
    }
    if (anyClamped) quality = "rough";
    const appeared = data.expected2027.appeared;
    const pBand = { low: pctLow, high: Math.max(pctLow, pctHigh) };
    air = band(
      { low: percentileToAir(pBand.high, appeared), high: percentileToAir(pBand.low, appeared) },
      quality,
      { label: "All India rank", ...(allThin ? { notEnoughData: true } : {}) },
    );
    percentile = { ...pBand, quality: air.quality };
    spread.push({
      label: "Year spread",
      text: perYear.map((p) => `${p.year} paper: AIR ${formatRankRange({ low: Math.round(p.lo), high: Math.round(p.hi) })}`).join(" · "),
    });
    spread.push({
      label: "2027 size",
      text: `Converted to about ${formatIndian(appeared)} candidates expected in 2027 (trend), not 2026's ${formatIndian(core.find((y) => y.year === 2026)?.appeared ?? 0)}.`,
    });
    if (mockBased) spread.push({ label: "Mock margin", text: `From an Origin mock, so we looked up ${marksUsed.low}–${marksUsed.high} marks.` });
  } else {
    notes.push("No NEET year with a marks-to-rank table is available.");
  }

  // Category rank (estimate) and PwD rank (rough).
  let categoryRank: RankBand | null = null;
  let pwdRank: RankBand | null = null;
  if (air && input.category !== "general") {
    const range = neetCategoryRankRange(core, input.category, air);
    if (range) {
      categoryRank = band(range, worstQuality("estimate", air.quality), { label: `${categoryLabel("neet", input.category)} rank` });
      notes.push("NTA does not publish category ranks; the category rank is an estimate from MCC allotments and NTA category counts.");
      for (const y of core) if (y.categoryShareByAirSourceId) sourceIds.push(y.categoryShareByAirSourceId);
    }
  }
  if (air && input.pwd) {
    const shares = core.map((y) => y.categoryShareAppeared?.pwdShare).filter((s): s is number => typeof s === "number");
    if (shares.length) {
      pwdRank = band({ low: air.low * Math.min(...shares), high: air.high * Math.max(...shares) }, "rough", { label: "PwBD rank" });
      notes.push("PwBD rank is rough: NTA gives only the PwBD share of candidates.");
    }
  }

  // State rank: real lists only.
  let stateRank: RankBand | null = null;
  let stateRankStatus: Prediction["stateRankStatus"] = "not_selected";
  if (input.homeState) {
    const code = NEET_STATE_LIST_CODE[input.homeState];
    const result = code ? neetStateRankFromList(data, code, marksUsed) : null;
    if (result) {
      const q = worstQuality(result.quality, mockBased ? "estimate" : "good_estimate", result.clamped ? "rough" : "good_estimate");
      stateRank = band(result.range, q, {
        label: `${input.homeState} state rank (${result.list.year} list)`,
        ...(result.list.points.length < THIN_LIST_POINTS ? { notEnoughData: true } : {}),
      });
      stateRankStatus = "ok";
      sourceIds.push(result.list.sourceId);
      if (result.clamped) notes.push(`Your marks are past the end of the ${input.homeState} list, so the state rank is rough.`);
    } else {
      stateRankStatus = "not_available";
      notes.push(`We don't have an official ${input.homeState} state merit list yet, so we can't show a state rank.`);
    }
  }

  const qualifying = neetQualifying(data.years, input.category, input.pwd, total);
  if (qualifying) for (const y of data.years) if (y.qualifyingCutoffSourceId) sourceIds.push(y.qualifyingCutoffSourceId);
  for (const n of data.notes ?? []) if (/computer-based/i.test(n)) notes.push("NEET 2027 may move to computer-based testing (not confirmed by NTA). If it does, these ranges will be re-checked.");

  return {
    exam: "neet",
    total,
    marksUsed,
    air,
    percentile,
    categoryRank,
    pwdRank,
    stateRank,
    stateRankStatus,
    eligibility: null,
    qualifying,
    topText: topText(air),
    spread,
    notes: uniq(notes),
    tieBreakNote: tieBreakNote("neet"),
    sourceIds: uniq(sourceIds),
    years: core.map((y) => y.year),
  };
}

// ─── JEE Main ────────────────────────────────────────────────────────────────

/** Years whose shift tables are real (only 2024 today). */
export function jeeMainShiftYears(data: JeeMainData): JeeMainYear[] {
  return data.years.filter((y) => (y.shifts?.length ?? 0) > 0);
}

export function jeeMainShiftIds(data: JeeMainData): string[] {
  return jeeMainShiftYears(data).flatMap((y) => y.shifts!.map((s) => s.id));
}

export type ShiftPercentile = { shift: JeeMainShift; percentile: number; clamped: boolean };

/**
 * Each real shift's percentile for a total. Above a shift's top mark the
 * percentile is 100 (nobody in that shift scored higher); below its bottom
 * mark it is the bottom percentile (clamped, "rough").
 */
export function jeeMainShiftPercentiles(data: JeeMainData, total: number): ShiftPercentile[] {
  return jeeMainShiftYears(data).flatMap((y) =>
    y.shifts!.map((shift) => {
      const r = lookupRange(shift.points, total);
      const percentile = r.clamped === "above" ? 100 : clamp((r.lo + r.hi) / 2, 0, 100);
      return { shift, percentile, clamped: r.clamped === "below" };
    }),
  );
}

/** Trimmed min..max over shifts: drop the single highest and lowest (plan §4.2 step 4). */
export function trimmedRange(values: number[]): NumberRange {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length >= 4) return { low: sorted[1], high: sorted[sorted.length - 2] };
  return { low: sorted[0], high: sorted[sorted.length - 1] };
}

/** Percentile band for a total: trimmed over all shifts, or ±0.15 around a known shift. */
export function jeeMainPercentileBand(
  data: JeeMainData,
  marks: NumberRange,
  shiftId: string | null | undefined,
): { band: NumberRange; clamped: boolean; shiftSpread: NumberRange } | null {
  const atLow = jeeMainShiftPercentiles(data, marks.low);
  const atHigh = jeeMainShiftPercentiles(data, marks.high);
  if (!atLow.length) return null;
  const allLow = atLow.map((s) => s.percentile);
  const allHigh = atHigh.map((s) => s.percentile);
  const shiftSpread = { low: Math.min(...allLow), high: Math.max(...allHigh) };
  if (shiftId) {
    const lo = atLow.find((s) => s.shift.id === shiftId);
    const hi = atHigh.find((s) => s.shift.id === shiftId);
    if (lo && hi) {
      return {
        band: {
          low: clamp(lo.percentile - KNOWN_SHIFT_HALF_WIDTH, 0, 100),
          high: clamp(hi.percentile + KNOWN_SHIFT_HALF_WIDTH, 0, 100),
        },
        clamped: lo.clamped || hi.clamped,
        shiftSpread,
      };
    }
  }
  const low = trimmedRange(allLow).low;
  const high = trimmedRange(allHigh).high;
  const clamped = atLow.every((s) => s.clamped) || atHigh.every((s) => s.clamped);
  return { band: { low, high: Math.max(low, high) }, clamped, shiftSpread };
}

/** Latest year that has a rank table for `key`. */
function latestRankTable(data: JeeMainData, key: string): { year: JeeMainYear; table: Pair[] } | null {
  const years = [...data.years].sort((a, b) => b.year - a.year);
  for (const year of years) {
    const table = year.rankTables?.[key];
    if (table?.length) return { year, table };
  }
  return null;
}

/**
 * Rank at a percentile from a percentile→rank table, scaled to the 2027
 * candidate count. Outside the table, the formula (100 − P)/100 × N + 1 is
 * used (plan §4.2 step 5), kept monotone with the table's end points.
 */
export function jeeMainRankAt(
  table: Pair[],
  percentile: number,
  appeared: number | null,
): { rank: number; lo: number; hi: number; clamped: boolean; usedFormula: boolean } {
  const r = lookupRange(table, percentile);
  const top = tableSpan(table).max;
  let rank = (r.lo + r.hi) / 2;
  let usedFormula = false;
  if (r.clamped === "below" && appeared) {
    rank = Math.max(r.hi, ((100 - percentile) / 100) * appeared + 1);
    usedFormula = true;
  }
  rank = Math.max(1, rank);
  // At or above the table's best percentile everyone there ties near the top:
  // the rank runs from 1 to the table's first rank (never "rank 0").
  if (percentile >= top) return { rank, lo: 1, hi: Math.max(1, r.hi), clamped: r.clamped !== null, usedFormula };
  return { rank, lo: rank, hi: rank, clamped: r.clamped !== null, usedFormula };
}

function jeeMainRankBand(
  data: JeeMainData,
  key: string,
  pct: NumberRange,
  isCrl: boolean,
  baseQuality: Quality,
  label: string,
  notes: string[],
  sourceIds: string[],
): RankBand | null {
  const found = latestRankTable(data, key);
  if (!found) return null;
  const { year, table } = found;
  const scale = data.expected2027.appeared / year.appeared;
  const best = jeeMainRankAt(table, pct.high, isCrl ? year.appeared : null);
  const worst = jeeMainRankAt(table, pct.low, isCrl ? year.appeared : null);
  const latestYear = Math.max(...data.years.map((y) => y.year));
  let quality = baseQuality;
  const thin = table.length < THIN_LIST_POINTS;
  if (!isCrl && (best.clamped || worst.clamped)) quality = "rough";
  if (year.year < latestYear) {
    quality = "rough";
    notes.push(`No ${latestYear} ${key} table exists; the ${label} uses ${year.year}'s, scaled to 2027.`);
  }
  if (year.rankTablesSourceId) sourceIds.push(year.rankTablesSourceId);
  return band({ low: best.lo * scale, high: worst.hi * scale }, quality, {
    label,
    ...(thin ? { notEnoughData: true } : {}),
  });
}

const JEE_MAIN_TABLE_KEY: Record<RankCategory, string> = {
  general: "CRL",
  ews: "EWS",
  "obc-ncl": "OBC-NCL",
  sc: "SC",
  st: "ST",
};

export function predictJeeMain(data: JeeMainData, input: PredictInput): Prediction {
  const ids = data.subjects.map((s) => s.id);
  const total = sumMarks(input.marks, ids);
  const marksUsed = marksWindow(total, "jee-main", input.source, data.minMarks, data.maxMarks);
  const notes: string[] = [];
  const spread: SpreadLine[] = [];
  const sourceIds: string[] = [];
  const mockBased = input.source?.kind === "attempt" || input.source?.kind === "avg3";

  const shiftYears = jeeMainShiftYears(data);
  const rankYear = latestRankTable(data, "CRL")?.year ?? null;
  for (const y of data.years) {
    if (y.shifts?.length) continue;
    if (y.shiftModel?.quality === "estimate") {
      notes.push(`${y.year}: NTA published no shift-wise tables, so ${y.year} uses the real 2024 shift shapes (estimate).`);
    } else {
      notes.push(`${y.year} skipped: no shift-wise marks-to-percentile table.`);
    }
  }
  for (const y of shiftYears) for (const s of y.shifts!) if (s.sourceId) sourceIds.push(s.sourceId);

  const pb = jeeMainPercentileBand(data, marksUsed, input.jeeMainShift);
  let percentile: PercentileBand | null = null;
  let air: RankBand | null = null;
  let categoryRank: RankBand | null = null;
  let pwdRank: RankBand | null = null;
  let eligibility: Prediction["eligibility"] = null;

  if (pb) {
    // 2024 shapes applied to a future paper: never better than "estimate".
    let quality: Quality = "estimate";
    if (pb.clamped) {
      quality = "rough";
      notes.push("Your total is outside the marks our shift tables cover, so the range is rough.");
    }
    percentile = { ...pb.band, quality };
    air = jeeMainRankBand(data, "CRL", pb.band, true, quality, "All India rank (CRL)", notes, sourceIds);
    if (input.category !== "general") {
      categoryRank = jeeMainRankBand(
        data,
        JEE_MAIN_TABLE_KEY[input.category],
        pb.band,
        false,
        quality,
        `${categoryLabel("jee-main", input.category)} rank`,
        notes,
        sourceIds,
      );
    }
    if (input.pwd) {
      const key = input.category === "general" ? "CRL-PwD" : `${JEE_MAIN_TABLE_KEY[input.category]}-PwD`;
      pwdRank = jeeMainRankBand(data, key, pb.band, false, quality, `${key} rank`, notes, sourceIds);
      if (!pwdRank) {
        pwdRank = jeeMainRankBand(data, "CRL-PwD", pb.band, false, "rough", "CRL-PwD rank", notes, sourceIds);
        notes.push(`No ${key} table in any year; showing the CRL-PwD rank instead (rough).`);
      }
    }
    eligibility = jeeAdvEligibility(data, pb.band, input.category, input.pwd);
    if (eligibility) {
      const y = data.years.find((yy) => yy.year === eligibility!.year);
      if (y?.advCutoffSourceId) sourceIds.push(y.advCutoffSourceId);
    }
    spread.push({
      label: "Shift spread",
      text: `The same marks gave ${formatPercentileRange(pb.shiftSpread)} percentile across ${shiftYears.map((y) => `${y.year}'s ${y.shifts!.length}`).join(", ")} shifts${input.jeeMainShift ? "" : " (we drop the easiest and toughest shift)"}.`,
    });
    if (rankYear) {
      spread.push({
        label: "2027 size",
        text: `Ranks use ${rankYear.year}'s percentile-to-rank table, scaled to about ${formatIndian(data.expected2027.appeared)} candidates expected in 2027.`,
      });
    }
    if (mockBased) spread.push({ label: "Mock margin", text: `From an Origin mock, so we looked up ${marksUsed.low}–${marksUsed.high} marks.` });
  } else {
    notes.push("No JEE Main shift table is available.");
  }

  return {
    exam: "jee-main",
    total,
    marksUsed,
    air,
    percentile,
    categoryRank,
    pwdRank,
    stateRank: null,
    stateRankStatus: "coming_soon",
    eligibility,
    qualifying: null,
    topText: topText(air),
    spread,
    notes: uniq(notes),
    tieBreakNote: tieBreakNote("jee-main"),
    sourceIds: uniq(sourceIds),
    years: uniq([...shiftYears.map((y) => y.year), ...(rankYear ? [rankYear.year] : [])]),
  };
}

// ─── JEE Advanced ────────────────────────────────────────────────────────────

export type AdvYearRank = { year: number; lo: number; hi: number; qualified: boolean; gap: number };

/**
 * Rank range for marks in one year's list. A candidate who does not make the
 * list that year is pinned to the list's last rank (flagged), so a band across
 * years stays monotone in marks; callers say "would not have qualified".
 */
export function jeeAdvRankForYear(
  year: JeeAdvYear,
  key: string,
  subjectMarks: readonly number[],
  total: number,
): AdvYearRank | null {
  const table = year.rankTables[key];
  if (!table?.length) return null;
  const q = jeeAdvQualifiesFor(year, key, subjectMarks, total);
  const span = tableSpan(table);
  const r = lookupRange(table, total);
  const lastRank = Math.max(...table.map(([, rank]) => rank));
  if ((q && !q.qualifies) || total < span.min) {
    return { year: year.year, lo: lastRank, hi: lastRank, qualified: false, gap: r.nearestGap };
  }
  const lo = total > span.max ? 1 : r.lo;
  return { year: year.year, lo: Math.max(1, lo), hi: Math.max(1, r.hi), qualified: true, gap: r.nearestGap };
}

/** The two latest years make the main band; older years are shown as context. */
export function jeeAdvCoreYears(data: JeeAdvancedData): { core: JeeAdvYear[]; older: JeeAdvYear[] } {
  const sorted = [...data.years].filter((y) => y.weight === "normal").sort((a, b) => b.year - a.year);
  return { core: sorted.slice(0, 2), older: sorted.slice(2) };
}

function advBand(
  years: JeeAdvYear[],
  key: string,
  subjects: number[],
  total: number,
): { range: NumberRange; perYear: AdvYearRank[]; thin: boolean } | null {
  const perYear = years
    .map((y) => jeeAdvRankForYear(y, key, subjects, total))
    .filter((r): r is AdvYearRank => r !== null)
    .sort((a, b) => a.year - b.year);
  if (!perYear.length || !perYear.some((r) => r.qualified)) return null;
  return {
    range: { low: Math.min(...perYear.map((r) => r.lo)), high: Math.max(...perYear.map((r) => r.hi)) },
    perYear,
    thin: perYear.every((r) => r.gap > THIN_GAP_MARKS),
  };
}

export function predictJeeAdvanced(data: JeeAdvancedData, input: PredictInput): Prediction {
  const ids = data.subjects.map((s) => s.id);
  const subjects = ids.map((id) => input.marks[id] ?? 0);
  const total = sumMarks(input.marks, ids);
  const minTotal = JEE_ADV_SUBJECT_MIN * ids.length;
  const marksUsed = marksWindow(total, "jee-advanced", input.source, minTotal, data.maxMarks);
  const notes: string[] = [];
  const spread: SpreadLine[] = [];
  const sourceIds: string[] = [];
  const mockBased = input.source?.kind === "attempt" || input.source?.kind === "avg3";
  const { core, older } = jeeAdvCoreYears(data);

  let baseQuality: Quality = "good_estimate";
  if (mockBased) {
    baseQuality = "rough";
    notes.push("Origin's JEE Advanced mock is one 198-mark paper; we scaled it to the real 360 marks, so this is rough.");
  }
  for (const y of core) {
    sourceIds.push(y.rankTablesSourceId);
    if (y.rankTablesQuality !== "official") {
      notes.push(`${y.year} ranks come from third-party anchor points (College Pravesh), not the official report.`);
    }
  }

  // Subjects scale with the window so the qualification check moves with it.
  const scaledSubjects = (t: number) => (total === 0 ? subjects.map(() => t / subjects.length) : subjects.map((s) => (s * t) / total));
  const lookupWindow = (key: string) => {
    const best = advBand(core, key, scaledSubjects(marksUsed.high), marksUsed.high);
    const worst = advBand(core, key, scaledSubjects(marksUsed.low), marksUsed.low);
    const atTotal = advBand(core, key, subjects, total);
    if (!best && !worst && !atTotal) return null;
    const parts = [best, worst, atTotal].filter((p): p is NonNullable<typeof p> => p !== null);
    return {
      range: { low: Math.min(...parts.map((p) => p.range.low)), high: Math.max(...parts.map((p) => p.range.high)) },
      perYear: (atTotal ?? best ?? worst)!.perYear,
      thin: parts.every((p) => p.thin),
    };
  };

  const crl = lookupWindow("CRL");
  let air: RankBand | null = null;
  if (crl) {
    air = band(crl.range, baseQuality, { label: "Common rank list (CRL)", ...(crl.thin ? { notEnoughData: true } : {}) });
    for (const r of crl.perYear) if (!r.qualified) notes.push(`With these marks you would not have made the ${r.year} CRL list.`);
    spread.push({
      label: "Year spread",
      text: crl.perYear
        .map((r) => `${r.year} paper: ${r.qualified ? `CRL ${formatRankRange({ low: Math.round(r.lo), high: Math.round(r.hi) })}` : "not on the CRL list"}`)
        .join(" · "),
    });
  } else {
    notes.push(`Below the CRL qualifying marks in ${core.map((y) => y.year).join(" and ")}, so there is no CRL rank.`);
  }
  if (older.length) {
    const old = advBand(older, "CRL", subjects, total);
    if (old) {
      spread.push({
        label: "Older papers",
        text: `In ${older.map((y) => y.year).sort().join("–")} the same marks gave CRL ${formatRankRange({ low: Math.round(old.range.low), high: Math.round(old.range.high) })}. The paper's difficulty changes the rank a lot.`,
      });
    }
  }

  let categoryRank: RankBand | null = null;
  if (input.category !== "general") {
    const key = jeeAdvListKey(input.category, false);
    const cat = lookupWindow(key);
    const points = Math.min(...core.map((y) => y.rankTables[key]?.length ?? 0));
    if (cat) {
      categoryRank = band(cat.range, baseQuality === "rough" ? "rough" : "estimate", {
        label: `${categoryLabel("jee-advanced", input.category)} rank`,
        ...(cat.thin || points < THIN_LIST_POINTS ? { notEnoughData: true } : {}),
      });
    } else {
      notes.push(`Below the ${categoryLabel("jee-advanced", input.category)} qualifying marks in recent years.`);
    }
  }

  let pwdRank: RankBand | null = null;
  if (input.pwd) {
    const pwd = lookupWindow("CRL-PwD");
    if (pwd) {
      pwdRank = band(pwd.range, "rough", { label: "CRL-PwD rank", notEnoughData: true });
    }
    if (input.category !== "general") notes.push(`No ${jeeAdvListKey(input.category, true)} marks-to-rank table exists; the PwD rank shown is the CRL-PwD rank (rough).`);
    else notes.push("The CRL-PwD table has only a few points, so the PwD rank is rough.");
  }

  const qualifying = jeeAdvQualification(data.years, input.category, input.pwd, subjects, total);
  for (const y of data.years) if (y.qualifyingSourceId) sourceIds.push(y.qualifyingSourceId);
  if (mockBased) spread.push({ label: "Mock margin", text: `From an Origin mock, so we looked up ${Math.round(marksUsed.low)}–${Math.round(marksUsed.high)} marks.` });

  return {
    exam: "jee-advanced",
    total,
    marksUsed,
    air,
    percentile: null,
    categoryRank,
    pwdRank,
    stateRank: null,
    stateRankStatus: "coming_soon",
    eligibility: null,
    qualifying,
    topText: topText(air),
    spread,
    notes: uniq(notes),
    tieBreakNote: tieBreakNote("jee-advanced"),
    sourceIds: uniq(sourceIds),
    years: core.map((y) => y.year).sort((a, b) => a - b),
  };
}

// ─── entry point ─────────────────────────────────────────────────────────────

export function predict(data: RankPredictorData, input: PredictInput): Prediction {
  switch (input.exam) {
    case "neet":
      return predictNeet(data.neet, input);
    case "jee-main":
      return predictJeeMain(data["jee-main"], input);
    case "jee-advanced":
      return predictJeeAdvanced(data["jee-advanced"], input);
  }
}

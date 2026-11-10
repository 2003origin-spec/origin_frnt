/**
 * Monotone piecewise-linear lookups over the data files' point tables.
 *
 * Rules (plan §4, DATA_NOTES.md): no extrapolation. Outside the table the
 * value is clamped to the end point and the caller is told (`clamped`), so it
 * can label the number "rough". Points with the same x (a mark shared by many
 * ranks, e.g. JEE Advanced 150 marks = ranks 5,701–5,801) are kept as a range.
 */

import type { Pair } from "./types";

export type Clamp = "below" | "above" | null;

/** A table sorted by x, with every distinct x holding the min..max y seen there. */
export type RangeTable = { xs: number[]; lo: number[]; hi: number[] };

export type RangeLookup = { lo: number; hi: number; clamped: Clamp; nearestGap: number };

const tableCache = new WeakMap<readonly Pair[], RangeTable>();

export function toRangeTable(points: readonly Pair[]): RangeTable {
  const cached = tableCache.get(points);
  if (cached) return cached;
  const byX = new Map<number, { lo: number; hi: number }>();
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const entry = byX.get(x);
    if (entry) {
      entry.lo = Math.min(entry.lo, y);
      entry.hi = Math.max(entry.hi, y);
    } else {
      byX.set(x, { lo: y, hi: y });
    }
  }
  const xs = [...byX.keys()].sort((a, b) => a - b);
  const table: RangeTable = {
    xs,
    lo: xs.map((x) => byX.get(x)!.lo),
    hi: xs.map((x) => byX.get(x)!.hi),
  };
  tableCache.set(points, table);
  return table;
}

function lerp(x0: number, y0: number, x1: number, y1: number, x: number): number {
  if (x1 === x0) return y0;
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
}

/**
 * Look x up in the table. Between two table x values both bounds are linear
 * blends of the neighbours' bounds; at a table x the stored min..max comes back
 * exactly. Empty tables throw — callers check for a missing year first.
 */
export function lookupRange(points: readonly Pair[], x: number): RangeLookup {
  const t = toRangeTable(points);
  const n = t.xs.length;
  if (n === 0) throw new Error("Empty lookup table.");
  if (x <= t.xs[0]) {
    return { lo: t.lo[0], hi: t.hi[0], clamped: x < t.xs[0] ? "below" : null, nearestGap: t.xs[0] - x };
  }
  if (x >= t.xs[n - 1]) {
    return { lo: t.lo[n - 1], hi: t.hi[n - 1], clamped: x > t.xs[n - 1] ? "above" : null, nearestGap: x - t.xs[n - 1] };
  }
  // Binary search for the segment [i, i+1] holding x.
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const mid = (a + b) >> 1;
    if (t.xs[mid] <= x) a = mid;
    else b = mid;
  }
  if (t.xs[a] === x) return { lo: t.lo[a], hi: t.hi[a], clamped: null, nearestGap: 0 };
  const x0 = t.xs[a];
  const x1 = t.xs[b];
  const v1 = lerp(x0, t.lo[a], x1, t.lo[b], x);
  const v2 = lerp(x0, t.hi[a], x1, t.hi[b], x);
  return {
    lo: Math.min(v1, v2),
    hi: Math.max(v1, v2),
    clamped: null,
    nearestGap: Math.min(x - x0, x1 - x),
  };
}

/** Single value (midpoint of the range at x). */
export function lookup(points: readonly Pair[], x: number): number {
  const r = lookupRange(points, x);
  return (r.lo + r.hi) / 2;
}

/** The x span a table covers. */
export function tableSpan(points: readonly Pair[]): { min: number; max: number } {
  const t = toRangeTable(points);
  return { min: t.xs[0], max: t.xs[t.xs.length - 1] };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

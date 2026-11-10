/**
 * Rank Predictor — labels, number formatting and the disclaimer. Client-safe.
 * Dates in the data files are already dd/mm/yyyy (owner rule).
 */

import type { NumberRange, Quality, RankCategory, RankPredictorExam } from "./types";

export const EXAM_LABEL: Record<RankPredictorExam, string> = {
  neet: "NEET",
  "jee-main": "JEE Main",
  "jee-advanced": "JEE Advanced",
};

export const SUBJECT_LABEL: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  maths: "Maths",
};

/** Category labels as each exam prints them. */
export function categoryLabel(exam: RankPredictorExam, category: RankCategory): string {
  if (exam === "jee-advanced") {
    return { general: "GEN (CRL)", ews: "GEN-EWS", "obc-ncl": "OBC-NCL", sc: "SC", st: "ST" }[category];
  }
  if (exam === "neet") {
    return { general: "General", ews: "EWS", "obc-ncl": "OBC", sc: "SC", st: "ST" }[category];
  }
  return { general: "General", ews: "EWS", "obc-ncl": "OBC-NCL", sc: "SC", st: "ST" }[category];
}

export const QUALITY_LABEL: Record<Quality, string> = {
  good_estimate: "Good estimate",
  estimate: "Estimate",
  rough: "Rough",
};

export const DISCLAIMER =
  "Estimate based on past years' official results and public data. Real ranks depend on your exam's difficulty and how everyone else does. This is guidance, not a promise of a rank or a seat.";

export const NOT_ENOUGH_DATA = "Not enough data for an exact range";

const indian = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** 122724 → "1,22,724" (Indian grouping). */
export function formatIndian(value: number): string {
  return indian.format(Math.round(value));
}

/** Step used to round a rank to a "nice" number (plan §5). */
function niceStep(value: number): number {
  if (value < 100) return 1;
  if (value < 1_000) return 10;
  if (value < 10_000) return 100;
  if (value < 100_000) return 500;
  if (value < 1_000_000) return 1_000;
  return 5_000;
}

/** Widen a rank range outwards to nice numbers; never below 1. */
export function roundRankRange(range: NumberRange): NumberRange {
  const lowStep = niceStep(range.low);
  const highStep = niceStep(range.high);
  const low = Math.max(1, Math.floor(range.low / lowStep) * lowStep);
  const high = Math.max(low, Math.ceil(range.high / highStep) * highStep);
  return { low, high };
}

export function roundPercentileRange(range: NumberRange): NumberRange {
  const low = Math.max(0, Math.floor(range.low * 100) / 100);
  const high = Math.min(100, Math.ceil(range.high * 100) / 100);
  return { low, high: Math.max(low, high) };
}

export function formatRankRange(range: NumberRange): string {
  if (range.low === range.high) return formatIndian(range.low);
  return `${formatIndian(range.low)} – ${formatIndian(range.high)}`;
}

export function formatPercentileRange(range: NumberRange): string {
  const f = (v: number) => v.toFixed(2);
  if (range.low === range.high) return f(range.low);
  return `${f(range.low)} – ${f(range.high)}`;
}

/** Screen-reader sentence, e.g. "All India rank between 48,000 and 56,000, good estimate" (T5.3). */
export function spokenRange(what: string, range: NumberRange, quality: Quality): string {
  const q = QUALITY_LABEL[quality].toLowerCase();
  if (range.low === range.high) return `${what} about ${formatIndian(range.low)}, ${q}`;
  return `${what} between ${formatIndian(range.low)} and ${formatIndian(range.high)}, ${q}`;
}

/** Short form for one-line summaries: 48,213 → "48k", 1,22,000 → "1.2 lakh". */
export function shortRank(value: number): string {
  if (value < 1_000) return String(Math.round(value));
  if (value < 100_000) return `${Math.round(value / 1_000)}k`;
  return `${(value / 100_000).toFixed(1).replace(/\.0$/, "")} lakh`;
}

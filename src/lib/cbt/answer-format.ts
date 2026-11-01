/**
 * Client-safe parsing of free-text answers into the CBT numeric model.
 *
 * The CBT grader scores `numerical` and `numerical_with_units` identically — it
 * reads ONE strictly parsed number and compares it within a tolerance; the unit
 * is a display label, never compared. So an answer like "3F" (3 Faraday) or
 * "9.8 m/s^2" is best stored as numerical_with_units (number + unit) rather than
 * rejected by the pure-`numerical` validator. This helper classifies a raw
 * answer string so the import mapper, the editor dialog and the grader
 * (`gradeCbtLocal`) all read numbers the same way.
 *
 * Numbers are parsed with the shared strict parser (bug-fix G2,
 * src/lib/assessments/parse-strict-number.ts): fractions ("3/4"), scientific
 * notation ("1E-3", "1×10^-3"), unicode minus and thousands grouping are read
 * as one number; anything ambiguous ("2 3", "2 or 3", "2,3") is non-numeric
 * instead of "first number wins".
 */

import { compactNumberText, parseStrictNumber, splitMagnitudeAndUnit } from "@/lib/assessments/parse-strict-number";

export type ParsedNumericAnswer =
  | { kind: "number"; number: string }
  | { kind: "number_unit"; number: string; unit: string }
  | { kind: "non_numeric" };

// A literal JS `Number()` reads identically ("9.8", "-2.5e3"); anything else
// ("3/4", "1×10^-3", "1,000") is stored as its decimal value. The import
// mapper and the CBT question validator both store this canonical form.
const NUMBER_LITERAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function canonicalNumber(magnitude: string, value: number): string {
  const compact = compactNumberText(magnitude);
  return NUMBER_LITERAL.test(compact) ? compact : String(value);
}

/**
 * A unit tail is only a unit when it is not an expression ("2n+1", "x=2") and
 * carries no second standalone number ("2 or 3", "5 m and 6 m"). Digits glued
 * to a unit ("m/s^2", "mol L-1") are part of it.
 */
function isUnitTail(unit: string): boolean {
  if (/[+=]/.test(unit)) return false;
  return !/(?:^|\s)[+-]?(?:\d|\.\d)/.test(unit);
}

export function parseNumericAnswer(raw: string | null | undefined): ParsedNumericAnswer {
  const text = String(raw ?? "").trim();
  if (!text) return { kind: "non_numeric" };

  const whole = parseStrictNumber(text);
  if (whole !== null) return { kind: "number", number: canonicalNumber(text, whole) };

  const parts = splitMagnitudeAndUnit(text);
  if (!parts || !parts.unit || !isUnitTail(parts.unit)) return { kind: "non_numeric" };
  const magnitude = parseStrictNumber(parts.magnitude);
  if (magnitude === null) return { kind: "non_numeric" };
  return { kind: "number_unit", number: canonicalNumber(parts.magnitude, magnitude), unit: rawUnit(text, magnitude) ?? parts.unit };
}

// The strict splitter compacts spacing around operators ("5 m/s east" →
// "m/seast"); keep the unit exactly as typed when a plain leading number reads
// as the same magnitude.
const PLAIN_LEADING_NUMBER = /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(.*)$/;

function rawUnit(text: string, magnitude: number): string | null {
  const match = text.match(PLAIN_LEADING_NUMBER);
  const unit = (match?.[2] ?? "").trim();
  if (!match || !unit || Number(match[1]) !== magnitude || !isUnitTail(unit)) return null;
  return unit;
}

/**
 * The single number a CBT numerical answer carries (its unit, if any, ignored),
 * or `null` when it is not exactly one number. Used by the CBT local grader.
 */
export function parseCbtNumber(raw: string | null | undefined): number | null {
  const parsed = parseNumericAnswer(raw);
  return parsed.kind === "non_numeric" ? null : Number(parsed.number);
}

/**
 * The one number a CBT numerical answer carries, as typed (compacted, unit
 * dropped: "9.80 m/s^2" → "9.80", "3/4" → "3/4"), or `null` when it is not
 * exactly one number. The typed text keeps the stated precision the grader's
 * decimal-exact rule (G1) reads, so CBT grades it the same with or without
 * the grader service.
 */
export function cbtNumberText(raw: string | null | undefined): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (parseStrictNumber(text) !== null) return compactNumberText(text);
  if (parseNumericAnswer(text).kind !== "number_unit") return null;
  const parts = splitMagnitudeAndUnit(text);
  return parts ? compactNumberText(parts.magnitude) : null;
}

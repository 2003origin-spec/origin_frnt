/**
 * Client-safe parsing of free-text answers into the CBT numeric model.
 *
 * The CBT grader scores `numerical` and `numerical_with_units` identically — it
 * extracts the leading number and compares it within a tolerance; the unit is a
 * display label, never compared. So an answer like "3F" (3 Faraday) or
 * "9.8 m/s^2" is best stored as numerical_with_units (number + unit) rather than
 * rejected by the pure-`numerical` validator. This helper classifies a raw
 * answer string so both the import mapper and the editor dialog can route it the
 * same way.
 */

export type ParsedNumericAnswer =
  | { kind: "number"; number: string }
  | { kind: "number_unit"; number: string; unit: string }
  | { kind: "non_numeric" };

// Leading number: optional sign, integer part, optional decimal, optional
// scientific exponent. Whatever non-empty text trails it is treated as the unit.
const LEADING_NUMBER = /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(.*)$/;

export function parseNumericAnswer(raw: string | null | undefined): ParsedNumericAnswer {
  const text = String(raw ?? "").trim();
  if (!text) return { kind: "non_numeric" };
  const match = text.match(LEADING_NUMBER);
  if (!match) return { kind: "non_numeric" };
  const number = match[1];
  const unit = (match[2] ?? "").trim();
  if (!unit) return { kind: "number", number };
  // A tail carrying an additive operator or equals sign is an algebraic
  // expression (e.g. "2n+1"), not a unit — grade it as an exact expression.
  if (/[+=]/.test(unit)) return { kind: "non_numeric" };
  return { kind: "number_unit", number, unit };
}

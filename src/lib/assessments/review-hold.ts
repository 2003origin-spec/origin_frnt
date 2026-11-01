/**
 * "Review hold" (bug-fix G2/G4): the grader could not parse the EXPECTED answer,
 * the submitted notation is unsupported (symbolic `parse_error`), a unit could
 * not be converted locally, or the remote grader errored on the item. That is a
 * tooling gap, not the student's mistake, so the item gets no credit AND no
 * negative marks, and is flagged needs_review.
 *
 * Mirror of `REVIEW_HOLD_REASONS` in grader-service/app/engine.py (plus the
 * TS-only `unit_conversion_unavailable`, since the fallback has no unit registry).
 * Used wherever marks are recomputed from credit (teacher mark schemes), so a
 * held item never falls through to `incorrectMarks`.
 */

export const REVIEW_HOLD_REASONS: ReadonlySet<string> = new Set([
  "parse_error",
  "expected_not_numeric",
  "expected_unit_parse_error",
  "missing_expected_value",
  "missing_expected_form",
  "unit_conversion_unavailable",
  // The remote grader failed on this one item (internal error): 0 marks + review.
  "grader_item_error",
  // G5: a symbolic answer too costly to evaluate, or the grader's bounded
  // evaluation ran out of time / budget.
  "input_too_long",
  "literal_too_long",
  "nesting_too_deep",
  "exponent_too_large",
  "exponent_tower",
  "expression_too_large",
  "number_too_large",
  "symbolic_timeout",
  "symbolic_budget_exhausted",
  "symbolic_worker_error",
]);

export function isReviewHold(grade: { isCorrect: boolean; info?: Record<string, unknown> | null }): boolean {
  if (grade.isCorrect) return false;
  const info = grade.info ?? {};
  if (info.reviewHold === true) return true;
  const codes = [info.reasonCodes, info.reason_codes].flatMap((value) => (Array.isArray(value) ? value : []));
  return codes.some((code) => typeof code === "string" && REVIEW_HOLD_REASONS.has(code));
}

/**
 * M4: a matrix answer made only of correct pairs (a strict subset of the key)
 * has no wrong pair, so it is never negative: complete-row credit, or 0.
 * Mirror of `NO_PENALTY_REASONS` in grader-service/app/engine.py.
 */
export const NO_PENALTY_REASONS: ReadonlySet<string> = new Set(["matrix_partial_rows", "matrix_mismatch"]);

export function isNoPenalty(grade: { isCorrect: boolean; info?: Record<string, unknown> | null }): boolean {
  if (grade.isCorrect) return false;
  const info = grade.info ?? {};
  const codes = [info.reasonCodes, info.reason_codes].flatMap((value) => (Array.isArray(value) ? value : []));
  return codes.some((code) => typeof code === "string" && NO_PENALTY_REASONS.has(code));
}

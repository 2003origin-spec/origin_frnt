/**
 * Matrix-match grading (bug-fix G3) — mirror of the matrix branch of
 * `compare_choice_question` in grader-service/app/engine.py.
 *
 * JEE Advanced matrix-match rule, per row: a row scores only when every correct
 * cell in it is marked and no incorrect cell in it is marked. Platform policy on
 * top: any wrong pair anywhere ⇒ the question is wrong (credit 0 ⇒
 * incorrect_marks); partial credit = fully-correct rows / rows and only when
 * submitted ⊆ expected. Ticking every cell is therefore NOT full marks.
 * M4: a strict subset has no wrong pair, so it is never negative — callers pass
 * `noPenalty` (see review-hold.ts NO_PENALTY_REASONS) and it scores 0 when no
 * row is complete.
 */

export type MatrixGrade = {
  isCorrect: boolean;
  creditAwarded: number;
  hasWrongPair: boolean;
  rows: number;
  completeRows: number;
  reason: "matrix_exact_match" | "matrix_wrong_pair" | "matrix_partial_rows" | "matrix_mismatch" | "missing_correct_pairs";
};

function normalizePairs(pairs: readonly (readonly number[])[] | null | undefined): string[] {
  const keys = new Set<string>();
  for (const pair of pairs ?? []) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    keys.add(`${Number(pair[0])}:${Number(pair[1])}`);
  }
  return [...keys];
}

export function gradeMatrixPairs(
  expectedPairs: readonly (readonly number[])[] | null | undefined,
  submittedPairs: readonly (readonly number[])[] | null | undefined,
  partialCreditPolicy: "fractional" | "none" | string = "fractional",
): MatrixGrade {
  const expected = normalizePairs(expectedPairs);
  const submitted = normalizePairs(submittedPairs);
  const expectedSet = new Set(expected);
  const submittedSet = new Set(submitted);
  const rowsSet = new Set(expected.map((key) => key.split(":")[0]));
  const rows = rowsSet.size;

  if (expected.length === 0) {
    return { isCorrect: false, creditAwarded: 0, hasWrongPair: submitted.length > 0, rows: 0, completeRows: 0, reason: "missing_correct_pairs" };
  }

  const isCorrect = submittedSet.size === expectedSet.size && submitted.every((key) => expectedSet.has(key));
  if (isCorrect) {
    return { isCorrect: true, creditAwarded: 1, hasWrongPair: false, rows, completeRows: rows, reason: "matrix_exact_match" };
  }

  const hasWrongPair = submitted.some((key) => !expectedSet.has(key));
  if (hasWrongPair) {
    return { isCorrect: false, creditAwarded: 0, hasWrongPair: true, rows, completeRows: 0, reason: "matrix_wrong_pair" };
  }

  const completeRows = [...rowsSet].filter((row) => {
    const expectedCols = expected.filter((key) => key.startsWith(`${row}:`));
    const submittedCols = submitted.filter((key) => key.startsWith(`${row}:`));
    return expectedCols.length === submittedCols.length && expectedCols.every((key) => submittedSet.has(key));
  }).length;

  if (partialCreditPolicy !== "fractional") {
    return { isCorrect: false, creditAwarded: 0, hasWrongPair: false, rows, completeRows, reason: "matrix_mismatch" };
  }
  return {
    isCorrect: false,
    creditAwarded: Number((completeRows / rows).toFixed(3)),
    hasWrongPair: false,
    rows,
    completeRows,
    reason: "matrix_partial_rows",
  };
}

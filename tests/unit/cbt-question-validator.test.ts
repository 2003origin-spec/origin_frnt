/**
 * CBT question editor validation for numeric answer keys. The validator reads
 * keys with the same strict parser as the import mapper and the grader, so a
 * teacher can type "3/4" or "1.5×10^-3" (stored as the canonical decimal) and
 * ambiguous keys ("2 or 3") are still rejected. Pure function, no database.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { validateQuestion } from "@/server/cbt/cbt-questions-service";
import type { CbtQuestionInput } from "@/lib/cbt/question-model";

function numerical(answerText: unknown, extra: Partial<CbtQuestionInput> = {}): CbtQuestionInput {
  return {
    stem: "Find x.",
    questionType: "numerical",
    answer: { answerText, tolerance: 0 },
    ...extra,
  } as CbtQuestionInput;
}

function withUnits(answerText: unknown, units: string): CbtQuestionInput {
  return { stem: "Find v.", questionType: "numerical_with_units", answer: { answerText, units, tolerance: 0 } } as CbtQuestionInput;
}

function status(fn: () => unknown): number | null {
  try {
    fn();
    return null;
  } catch (err) {
    return (err as { status?: number }).status ?? -1;
  }
}

test("numerical keys accept fractions and scientific notation, stored as decimals", () => {
  const cases: Array<[string, string]> = [
    ["3/4", "0.75"],
    ["1.5×10^-3", "0.0015"],
    ["1.5x10^-3", "0.0015"],
    ["1E-3", "1E-3"],
    ["−2.5", "-2.5"],
    ["1,000", "1000"],
    ["9.8", "9.8"],
    [" 42 ", "42"],
  ];
  for (const [input, stored] of cases) {
    const { answer } = validateQuestion(numerical(input));
    assert.equal(answer.answerText, stored, input);
    assert.ok(Number.isFinite(Number(answer.answerText)), `${input} stored as a Number()-readable string`);
  }
});

test("numerical keys stay strict: ambiguous, empty and unit-bearing keys are 400", () => {
  for (const input of ["2 3", "2 or 3", "2,3", "abc", "", "   ", null, undefined]) {
    assert.equal(status(() => validateQuestion(numerical(input))), 400, String(input));
  }
  // A unit belongs in the Units field, never silently dropped from a numerical key.
  assert.equal(status(() => validateQuestion(numerical("3F"))), 400);
});

test("a numeric (non-string) key still works", () => {
  assert.equal(validateQuestion(numerical(0.25)).answer.answerText, "0.25");
  assert.equal(status(() => validateQuestion(numerical(Number.NaN))), 400);
});

test("numerical_with_units keys use the same parser and keep the unit separate", () => {
  const { answer } = validateQuestion(withUnits("6.022×10^23", "mol^-1"));
  assert.equal(Number(answer.answerText), 6.022e23);
  assert.equal(answer.units, "mol^-1");
  assert.equal(validateQuestion(withUnits("1/2", "m/s")).answer.answerText, "0.5");
  assert.equal(status(() => validateQuestion(withUnits("5 m", "m"))), 400);
  assert.equal(status(() => validateQuestion(withUnits("2 or 3", "m"))), 400);
  assert.equal(status(() => validateQuestion(withUnits("3/4", ""))), 400);
});

import test from "node:test";
import assert from "node:assert/strict";

import { parseNumericAnswer } from "../src/lib/cbt/answer-format";
import { importQuestionToCbtInput } from "../src/server/cbt/cbt-import-service";
import type { ImportJobQuestion } from "../src/server/workspaces/types";

test("parseNumericAnswer classifies pure numbers, number+unit, and non-numeric answers", () => {
  assert.deepEqual(parseNumericAnswer("3"), { kind: "number", number: "3" });
  assert.deepEqual(parseNumericAnswer("9.8"), { kind: "number", number: "9.8" });
  assert.deepEqual(parseNumericAnswer("-2.5e3"), { kind: "number", number: "-2.5e3" });
  assert.deepEqual(parseNumericAnswer("3F"), { kind: "number_unit", number: "3", unit: "F" });
  assert.deepEqual(parseNumericAnswer("9.8 m/s^2"), { kind: "number_unit", number: "9.8", unit: "m/s^2" });
  assert.deepEqual(parseNumericAnswer("2 mol"), { kind: "number_unit", number: "2", unit: "mol" });
  assert.deepEqual(parseNumericAnswer("x^2 + 1"), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer(""), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer(null), { kind: "non_numeric" });
});

function importQuestion(overrides: Partial<ImportJobQuestion>): ImportJobQuestion {
  return {
    id: "iq",
    questionText: "Q",
    questionType: "numerical",
    options: null,
    correctOption: null,
    correctOptions: null,
    answerText: null,
    ...overrides,
  } as unknown as ImportJobQuestion;
}

test("import routes a number+unit answer to numerical_with_units (split)", () => {
  const input = importQuestionToCbtInput(importQuestion({ answerText: "3F" }));
  assert.equal(input.questionType, "numerical_with_units");
  assert.equal((input.answer as { answerText?: string }).answerText, "3");
  assert.equal((input.answer as { units?: string }).units, "F");
});

test("import keeps a pure-number answer numerical", () => {
  const input = importQuestionToCbtInput(importQuestion({ answerText: "42" }));
  assert.equal(input.questionType, "numerical");
  assert.equal((input.answer as { answerText?: string }).answerText, "42");
});

test("import demotes a non-numeric numerical answer to an exact-match expression", () => {
  const input = importQuestionToCbtInput(importQuestion({ answerText: "2n+1" }));
  assert.equal(input.questionType, "symbolic_expression");
  assert.equal((input.answer as { answerText?: string }).answerText, "2n+1");
});

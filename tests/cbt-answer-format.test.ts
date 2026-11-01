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

test("parseNumericAnswer reads one strict number (G2): no 'first number wins'", () => {
  // Used to split into number "3" + unit "/4", "1" + "×10^-3", "2" + "3".
  assert.deepEqual(parseNumericAnswer("3/4"), { kind: "number", number: "0.75" });
  assert.deepEqual(parseNumericAnswer("1×10^-3"), { kind: "number", number: "0.001" });
  assert.deepEqual(parseNumericAnswer("1E-3"), { kind: "number", number: "1E-3" });
  assert.deepEqual(parseNumericAnswer("−5"), { kind: "number", number: "-5" });
  assert.deepEqual(parseNumericAnswer("1,000"), { kind: "number", number: "1000" });
  assert.deepEqual(parseNumericAnswer("1.5×10^-3 m"), { kind: "number_unit", number: "0.0015", unit: "m" });
  assert.deepEqual(parseNumericAnswer("5 m/s east"), { kind: "number_unit", number: "5", unit: "m/s east" });
  assert.deepEqual(parseNumericAnswer("2 3"), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer("2 or 3"), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer("2,3"), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer("2 m or 3 m"), { kind: "non_numeric" });
  assert.deepEqual(parseNumericAnswer("5 (approx)"), { kind: "non_numeric" });
  // Every number it returns is one the CBT question validator (Number()) accepts.
  for (const raw of ["3/4", "1×10^-3", "1,00,000", "10^3", "Ans: 5", "3/4 kg"]) {
    const parsed = parseNumericAnswer(raw);
    assert.notEqual(parsed.kind, "non_numeric", raw);
    if (parsed.kind !== "non_numeric") assert.ok(Number.isFinite(Number(parsed.number)), raw);
  }
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

test("import stores a fraction answer as its value, not its leading number", () => {
  const input = importQuestionToCbtInput(importQuestion({ answerText: "3/4" }));
  assert.equal(input.questionType, "numerical");
  assert.equal((input.answer as { answerText?: string }).answerText, "0.75");
});

test("import demotes an ambiguous two-number answer instead of keeping the first", () => {
  const input = importQuestionToCbtInput(importQuestion({ answerText: "2 or 3" }));
  assert.equal(input.questionType, "symbolic_expression");
  assert.equal((input.answer as { answerText?: string }).answerText, "2 or 3");
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

test("import maps worker metadata.imageUrl onto CBT image", () => {
  const input = importQuestionToCbtInput(
    importQuestion({
      metadata: { imageUrl: "https://pub.example.r2.dev/imports/job/diagrams/q_0.png" },
    }),
  );
  assert.equal(input.image, "https://pub.example.r2.dev/imports/job/diagrams/q_0.png");
});

test("import leaves image null when metadata has no imageUrl", () => {
  const input = importQuestionToCbtInput(importQuestion({ metadata: {} }));
  assert.equal(input.image, null);
});

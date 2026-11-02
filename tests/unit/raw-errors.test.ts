/**
 * Raw service errors must never reach students (01/11/2026: a grader 422 —
 * `{"detail":[{"type":"dict_type",...symbolAssumptions...}]}` — showed in the
 * app under a question). Null spec fields are dropped before grading, and the
 * mobile API only passes human sentences through.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { compactAnswerSpec, GRADER_UNAVAILABLE_MESSAGE, GraderContractError } from "../../src/server/grader-client";
import { isStudentReadable } from "../../src/server/mobile/app-api";

test("null answer-spec fields are dropped so the grader's defaults apply", () => {
  assert.deepEqual(compactAnswerSpec({ gradingMode: "mcq", symbolAssumptions: null, acceptedForms: undefined, tolerance: 0 }), {
    gradingMode: "mcq",
    tolerance: 0,
  });
  assert.equal(compactAnswerSpec(null), null);
  assert.equal(compactAnswerSpec(undefined), null);
});

test("a grader contract error carries a student message and keeps the raw reason for logs", () => {
  const raw = '{"detail":[{"type":"dict_type","loc":["body","items",0]}]}';
  const err = new GraderContractError(GRADER_UNAVAILABLE_MESSAGE, 422, raw);
  assert.equal(err.message, GRADER_UNAVAILABLE_MESSAGE);
  assert.equal(err.detail, raw);
  assert.equal(isStudentReadable(err.message), true);
});

test("only human sentences pass through to students", () => {
  assert.equal(isStudentReadable("You can only challenge friends who follow you back."), true);
  assert.equal(isStudentReadable('{"detail":[{"type":"dict_type"}]}'), false);
  assert.equal(isStudentReadable('[{"loc":["body"],"msg":"x"}]'), false);
  assert.equal(isStudentReadable("TypeError: Cannot read properties of undefined"), false);
  assert.equal(isStudentReadable(""), false);
  assert.equal(isStudentReadable("x".repeat(301)), false);
});

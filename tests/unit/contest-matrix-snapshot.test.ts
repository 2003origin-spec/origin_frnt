/**
 * Contest matrix-match grading from the REAL frozen snapshot.
 *
 * contest-question-selection.ts `freezeSnapshot` copies the OGCode catalog's
 * `matrix_data` as-is — the `{ column_a, column_b, correct_pairs }` object — so
 * the submit path used to read `Array.isArray(snapshot.matrixData)` as false and
 * no contest matrix question could ever score.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { gradeContest, snapshotMatrixPairs } from "@/lib/contest/grade";
import { gradableFromFrozenRow, type FrozenQuestionRow } from "@/server/contest/contest-submit-service";
import { DEFAULT_CONTEST_SCORING } from "@/lib/contest/contest-config";

// Shape written by freezeSnapshot() for an OGCode matrix_match question.
const frozenRow: FrozenQuestionRow = {
  position: 0,
  question_id: "ogc-matrix-1",
  subject: "Physics",
  snapshot: {
    text: "Match List-I (quantity) with List-II (unit).",
    options: null,
    image: null,
    optionImages: null,
    correctOption: null,
    correctOptions: null,
    answerText: null,
    tolerance: null,
    answerSpec: null,
    matrixData: {
      column_a: ["Force", "Energy", "Power"],
      column_b: ["Newton", "Joule", "Watt", "Pascal"],
      correct_pairs: [[0, 0], [1, 1], [2, 2]],
    },
    explanation: "",
    subject: "Physics",
    chapter: "Units and Measurement",
    difficulty: "medium",
    questionType: "matrix_match",
  },
  marks: null,
  negative_marks: null,
};

const scoring = { ...DEFAULT_CONTEST_SCORING, correctMarks: 4, incorrectMarks: -1, unattemptedMarks: 0 };

test("frozen matrix snapshot: the pairs are read out of the matrixData object", () => {
  assert.deepEqual(gradableFromFrozenRow(frozenRow).matrixData, [[0, 0], [1, 1], [2, 2]]);
});

test("frozen matrix snapshot: a fully-correct answer scores full marks", () => {
  const q = gradableFromFrozenRow(frozenRow);
  const r = gradeContest([q], { "0": { matrixPairs: [[2, 2], [0, 0], [1, 1]] } }, scoring);
  assert.equal(r.correct, 1);
  assert.equal(r.score, 4);
});

test("frozen matrix snapshot: a superset (extra wrong pair) scores the negative mark", () => {
  const q = gradableFromFrozenRow(frozenRow);
  const r = gradeContest([q], { "0": { matrixPairs: [[0, 0], [1, 1], [2, 2], [2, 3]] } }, scoring);
  assert.equal(r.correct, 0);
  assert.equal(r.incorrect, 1);
  assert.equal(r.score, -1);
});

test("snapshotMatrixPairs tolerates a JSON string, camelCase and a legacy pairs array", () => {
  const pairs = [[0, 1], [1, 0]];
  assert.deepEqual(snapshotMatrixPairs({ column_a: ["P", "Q"], column_b: ["1", "2"], correct_pairs: pairs }), pairs);
  assert.deepEqual(snapshotMatrixPairs(JSON.stringify({ correct_pairs: pairs })), pairs);
  assert.deepEqual(snapshotMatrixPairs({ correctPairs: pairs }), pairs);
  assert.deepEqual(snapshotMatrixPairs(pairs), pairs);
  assert.equal(snapshotMatrixPairs(null), null);
  assert.equal(snapshotMatrixPairs({ column_a: [], column_b: [] }), null);
  assert.equal(snapshotMatrixPairs("not json"), null);
});

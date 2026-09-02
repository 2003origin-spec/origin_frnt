import test from "node:test";
import assert from "node:assert/strict";

import { importQuestionToContestInput } from "@/server/contest/contest-import-service";
import type { ImportJobQuestion } from "@/server/workspaces/types";

function makeQ(partial: Partial<ImportJobQuestion>): ImportJobQuestion {
  return {
    id: "q1", jobId: "j1", pageId: null, questionNumber: 1,
    questionType: "mcq", subject: null, chapter: null, concept: null, difficulty: null,
    questionText: "What is 2 + 2?", options: null,
    correctOption: null, correctOptions: null, answerText: null, explanation: null, hint: null,
    hasDiagram: false, diagramDescription: null, status: "draft",
    confidenceScore: null, reviewNotes: null, rejectionReason: null,
    questionBagQuestionId: null, metadata: {}, imageUrl: null, optionImages: null,
    createdAt: "", updatedAt: "",
    ...partial,
  };
}

test("importQuestionToContestInput maps a 4-option MCQ as contest-eligible", () => {
  const draft = importQuestionToContestInput(
    makeQ({ options: ["2", "3", "4", "5"] as unknown as Record<string, unknown>, correctOption: 2, subject: "Physics", chapter: "Units" }),
  );
  assert.equal(draft.options.length, 4);
  assert.equal(draft.correctOption, 2);
  assert.equal(draft.subject, "physics"); // normalized
  assert.equal(draft.chapter, "Units");
  assert.equal(draft.mcqEligible, true);
});

test("importQuestionToContestInput flags an option-less question as not MCQ-eligible", () => {
  const draft = importQuestionToContestInput(makeQ({ options: null, questionType: "subjective" }));
  assert.equal(draft.options.length, 0);
  assert.equal(draft.mcqEligible, false);
});

test("importQuestionToContestInput coerces an out-of-range correct option to 0", () => {
  const draft = importQuestionToContestInput(
    makeQ({ options: ["a", "b"] as unknown as Record<string, unknown>, correctOption: 9 }),
  );
  assert.equal(draft.correctOption, 0);
  assert.equal(draft.mcqEligible, true);
});

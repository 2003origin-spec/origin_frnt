import test from "node:test";
import assert from "node:assert/strict";

import { mapContentQuestionToStored } from "../../src/server/workspaces/test-question-resolver";
import type { QuestionWithVersion, QuestionVersion } from "../../src/server/workspaces/types";

function makeVersion(overrides: Partial<QuestionVersion> = {}): QuestionVersion {
  return {
    id: "qv_1",
    questionId: "q_1",
    versionNumber: 1,
    questionType: "mcq",
    stem: "What is 2+2?",
    options: [{ id: "a", text: "3" }, { id: "b", text: "4" }],
    correctOption: 1,
    correctOptions: null,
    answerText: null,
    answerSpec: null,
    matrixData: null,
    imageUrl: null,
    hint: null,
    explanation: "Basic arithmetic.",
    fullSolution: null,
    subject: "mathematics",
    chapter: "Arithmetic",
    concept: "Addition",
    difficulty: "easy",
    tags: [],
    importEvidence: {},
    metadata: {},
    createdBy: "user_teacher_1",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeQwv(version: QuestionVersion | null): QuestionWithVersion {
  return {
    id: "q_1",
    ownerScope: "workspace",
    workspaceId: "ws_1",
    createdBy: "user_teacher_1",
    currentVersionId: version?.id ?? null,
    visibility: "workspace",
    status: "ready",
    sourceKind: "manual",
    importedJobId: null,
    externalSourceId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentVersion: version,
  } as QuestionWithVersion;
}

test("mapContentQuestionToStored passes through well-formed taxonomy fields as-is", () => {
  const stored = mapContentQuestionToStored(makeQwv(makeVersion()));
  assert.ok(stored);
  assert.equal(stored!.subject, "mathematics");
  assert.equal(stored!.chapter, "Arithmetic");
  assert.equal(stored!.concept, "Addition");
  assert.equal(stored!.difficulty, "easy");
});

test("mapContentQuestionToStored returns null when there is no current version", () => {
  assert.equal(mapContentQuestionToStored(makeQwv(null)), null);
});

// Regression: Question-Bag authoring doesn't runtime-enforce non-empty taxonomy
// fields (the DB read casts `row.subject as string` with no validation), and
// analytics-service's GradedAttempt requires subject/chapter/concept/difficulty
// as non-nullable strings — a blank one used to reach analytics unguarded,
// risking a hard Pydantic validation failure (null) or a meaningless
// empty-string "topic" (empty string) for the WHOLE test's weak-topic analysis.
test("mapContentQuestionToStored defaults blank/null taxonomy fields instead of passing them through empty", () => {
  const version = makeVersion({
    subject: null as unknown as string,
    chapter: "" as unknown as string,
    concept: null as unknown as string,
    difficulty: undefined as unknown as QuestionVersion["difficulty"],
  });
  const stored = mapContentQuestionToStored(makeQwv(version));
  assert.ok(stored);
  assert.equal(stored!.subject, "general");
  assert.equal(stored!.chapter, "Uncategorized");
  // chapter is ALSO blank here, so concept falls all the way to the final default.
  assert.equal(stored!.concept, "General");
  assert.equal(stored!.difficulty, "medium");
  for (const field of [stored!.subject, stored!.chapter, stored!.concept, stored!.difficulty]) {
    assert.ok(typeof field === "string" && field.length > 0, "field must be a non-empty string");
  }
});

test("mapContentQuestionToStored rejects an invalid difficulty value rather than passing it through", () => {
  const stored = mapContentQuestionToStored(
    makeQwv(makeVersion({ difficulty: "impossible" as unknown as QuestionVersion["difficulty"] })),
  );
  assert.equal(stored!.difficulty, "medium");
});

test("mapContentQuestionToStored falls back concept to chapter when only concept is blank", () => {
  const stored = mapContentQuestionToStored(
    makeQwv(makeVersion({ chapter: "Thermodynamics", concept: "" as unknown as string })),
  );
  assert.equal(stored!.concept, "Thermodynamics");
});

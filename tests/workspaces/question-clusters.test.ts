/**
 * Question clusters + blueprint-aware stacking — pure-logic coverage.
 * Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §6.
 *
 * The SQL side (ordering, dedup, ownership) is exercised by the live DB probe,
 * which is the only place those semantics actually live. What is testable
 * without a database is the blueprint parsing and the source→section mapping —
 * and, critically, that a test WITHOUT a blueprint is untouched.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  TEACHER_TEST_SOURCE_KINDS,
  blueprintSectionsOf,
} from "../../src/server/workspaces/test-sources-service";
import { stackSources } from "../../src/lib/assessments/source-stack";

// ─── The new source kind ─────────────────────────────────────────────────────

test("cluster joins the existing source kinds without displacing them", () => {
  assert.deepEqual([...TEACHER_TEST_SOURCE_KINDS].sort(), [
    "bag_topic",
    "cluster",
    "import_job",
    "test",
  ]);
});

// ─── Blueprint detection ─────────────────────────────────────────────────────

const FULL_MOCK_POLICY = {
  kind: "full_length_mock",
  preset: "jee-advanced",
  sections: [
    { id: "physics-1", label: "Physics — Section 1", plannedCount: 6, marks: { correct: 3, incorrect: -1 } },
    { id: "physics-2", label: "Physics — Section 2", plannedCount: 6, marks: { correct: 4, incorrect: -2 } },
    { id: "physics-3", label: "Physics — Section 3", plannedCount: 6, marks: { correct: 4, incorrect: 0 } },
  ],
};

test("a full-mock selection policy yields its sections", () => {
  const sections = blueprintSectionsOf(FULL_MOCK_POLICY)!;
  assert.equal(sections.length, 3);
  assert.equal(sections[0].id, "physics-1");
  assert.equal(sections[0].marks.correct, 3);
  assert.equal(sections[2].marks.incorrect, 0);
});

test("selection_policy is free-form JSONB, so anything without the discriminator is ignored", () => {
  // The regression that matters: other builders write into selection_policy too.
  assert.equal(blueprintSectionsOf(null), null);
  assert.equal(blueprintSectionsOf(undefined), null);
  assert.equal(blueprintSectionsOf({}), null);
  assert.equal(blueprintSectionsOf({ sections: FULL_MOCK_POLICY.sections }), null, "no kind discriminator");
  assert.equal(blueprintSectionsOf({ kind: "something_else", sections: FULL_MOCK_POLICY.sections }), null);
  assert.equal(blueprintSectionsOf({ kind: "full_length_mock" }), null, "no sections");
  assert.equal(blueprintSectionsOf({ kind: "full_length_mock", sections: "nope" }), null);
  assert.equal(blueprintSectionsOf({ kind: "full_length_mock", sections: [] }), null);
});

test("a malformed section is dropped rather than corrupting the blueprint", () => {
  const sections = blueprintSectionsOf({
    kind: "full_length_mock",
    sections: [
      { id: 42, marks: { correct: 3, incorrect: -1 } },
      { id: "ok", label: "OK", plannedCount: 5, marks: { correct: "banana", incorrect: null } },
    ],
  })!;
  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, "ok");
  // Non-numeric marks fall back to the platform default rather than NaN.
  assert.equal(sections[0].marks.correct, 4);
  assert.equal(sections[0].marks.incorrect, -1);
});

// ─── Source → section mapping (D6) ───────────────────────────────────────────

/**
 * Mirrors what `resolveTeacherTestSources` does once the stack is resolved:
 * source *i* → section *i*, and each question inherits its source's section.
 */
function mapToSections(
  perSource: { id: string }[],
  questions: { questionId: string; sourceId: string; marks: number; negativeMarks: number }[],
  sections: ReturnType<typeof blueprintSectionsOf>,
) {
  const bySource = new Map<string, NonNullable<typeof sections>[number]>();
  if (sections?.length) {
    perSource.forEach((entry, index) => {
      const section = sections[index];
      if (section) bySource.set(entry.id, section);
    });
  }
  return questions.map((q) => {
    const section = bySource.get(q.sourceId);
    return {
      questionId: q.questionId,
      marks: section ? section.marks.correct : q.marks,
      negativeMarks: section ? section.marks.incorrect : q.negativeMarks,
      sectionId: section?.id,
    };
  });
}

const THREE_CLUSTERS = [
  { kind: "cluster" as const, id: "c1", questionIds: ["a", "b"], marks: 4, negativeMarks: -1 },
  { kind: "cluster" as const, id: "c2", questionIds: ["c", "d"], marks: 4, negativeMarks: -1 },
  { kind: "cluster" as const, id: "c3", questionIds: ["e", "f"], marks: 4, negativeMarks: -1 },
];

test("stacked clusters land in blueprint sections in pick order, inheriting their marks", () => {
  const stacked = stackSources(THREE_CLUSTERS);
  const mapped = mapToSections(stacked.perSource, stacked.questions, blueprintSectionsOf(FULL_MOCK_POLICY));

  assert.deepEqual(
    mapped.map((q) => q.sectionId),
    ["physics-1", "physics-1", "physics-2", "physics-2", "physics-3", "physics-3"],
  );
  // Section 1 is +3/-1, Section 2 is +4/-2, Section 3 is +4/0 — three different
  // schemes in one paper, none of them the flat +4/-1 the sources carried.
  assert.deepEqual(mapped.map((q) => `${q.marks}/${q.negativeMarks}`), [
    "3/-1", "3/-1", "4/-2", "4/-2", "4/0", "4/0",
  ]);
});

test("sources past the last section fall back to their own marks instead of erroring", () => {
  const stacked = stackSources([
    ...THREE_CLUSTERS,
    { kind: "cluster" as const, id: "c4", questionIds: ["g"], marks: 7, negativeMarks: -3 },
  ]);
  const mapped = mapToSections(stacked.perSource, stacked.questions, blueprintSectionsOf(FULL_MOCK_POLICY));
  const overflow = mapped.find((q) => q.questionId === "g")!;
  assert.equal(overflow.sectionId, undefined);
  assert.equal(overflow.marks, 7);
  assert.equal(overflow.negativeMarks, -3);
});

test("with NO blueprint every question keeps its per-source marks — the pre-existing behaviour", () => {
  const stacked = stackSources([
    { kind: "import_job" as const, id: "j1", questionIds: ["a"], marks: 2, negativeMarks: -0.5 },
    { kind: "bag_topic" as const, id: "t1", questionIds: ["b"], marks: 5, negativeMarks: 0 },
  ]);
  const mapped = mapToSections(stacked.perSource, stacked.questions, null);
  assert.deepEqual(mapped, [
    { questionId: "a", marks: 2, negativeMarks: -0.5, sectionId: undefined },
    { questionId: "b", marks: 5, negativeMarks: 0, sectionId: undefined },
  ]);
});

test("a question picked twice keeps its first position, so section assignment is stable", () => {
  const stacked = stackSources([
    { kind: "cluster" as const, id: "c1", questionIds: ["a", "b"], marks: 4, negativeMarks: -1 },
    { kind: "cluster" as const, id: "c2", questionIds: ["b", "c"], marks: 4, negativeMarks: -1 },
  ]);
  const mapped = mapToSections(stacked.perSource, stacked.questions, blueprintSectionsOf(FULL_MOCK_POLICY));
  assert.deepEqual(mapped.map((q) => q.questionId), ["a", "b", "c"]);
  // "b" came from c1 first, so it stays in section 1 rather than moving to 2.
  assert.deepEqual(mapped.map((q) => q.sectionId), ["physics-1", "physics-1", "physics-2"]);
});

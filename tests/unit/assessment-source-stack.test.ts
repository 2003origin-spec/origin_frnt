/**
 * The shared multi-source stacker, used by both the CBT builder and the Origin
 * teacher builder.
 *
 * What has to hold: selection order IS paper order, an overlapping question
 * keeps its EARLIEST position (asking it twice in one paper is the bug), the
 * marks come from the source that placed it, and a malformed `sources` array
 * degrades instead of throwing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SOURCE_MARKS,
  DEFAULT_SOURCE_NEGATIVE_MARKS,
  parseSources,
  stackSources,
  type ResolvedTestSource,
} from "@/lib/assessments/source-stack";
import { parseTestSources } from "@/lib/cbt/source-stack";
import { TEACHER_TEST_SOURCE_KINDS } from "@/server/workspaces/test-sources-service";

type Kind = "import_job" | "bag_topic" | "test";

function source(id: string, questionIds: string[], extra: Partial<ResolvedTestSource<Kind>> = {}) {
  return { kind: "import_job" as Kind, id, questionIds, ...extra };
}

test("selection order is paper order, each source keeping its own sequence", () => {
  const result = stackSources<Kind>([
    source("doc-a", ["q3", "q1"]),
    source("doc-b", ["q9", "q7"]),
  ]);
  assert.deepEqual(
    result.questions.map((q) => q.questionId),
    ["q3", "q1", "q9", "q7"],
  );
});

test("an overlapping question keeps its earliest position and the first source's marks", () => {
  const result = stackSources<Kind>([
    source("doc-a", ["q1", "q2"], { marks: 4, negativeMarks: -1 }),
    source("doc-b", ["q2", "q3"], { marks: 2, negativeMarks: 0 }),
  ]);
  assert.deepEqual(result.questions.map((q) => q.questionId), ["q1", "q2", "q3"]);
  // q2 came from doc-a, so it carries doc-a's scheme, not doc-b's.
  const q2 = result.questions.find((q) => q.questionId === "q2")!;
  assert.equal(q2.marks, 4);
  assert.equal(q2.negativeMarks, -1);
  assert.equal(q2.sourceId, "doc-a");
});

test("per-source counts report what was added and what was a duplicate", () => {
  const result = stackSources<Kind>([
    source("doc-a", ["q1", "q2"]),
    source("doc-b", ["q2", "q3", "q1"]),
  ]);
  assert.deepEqual(result.perSource, [
    { kind: "import_job", id: "doc-a", added: 2, duplicates: 0 },
    { kind: "import_job", id: "doc-b", added: 1, duplicates: 2 },
  ]);
});

test("a source that resolves to nothing is still reported, with zero added", () => {
  const result = stackSources<Kind>([source("empty", [])]);
  assert.equal(result.questions.length, 0);
  assert.deepEqual(result.perSource, [{ kind: "import_job", id: "empty", added: 0, duplicates: 0 }]);
});

test("blank question ids are dropped without counting as duplicates", () => {
  const result = stackSources<Kind>([source("doc-a", ["q1", "", "q2"])]);
  assert.deepEqual(result.questions.map((q) => q.questionId), ["q1", "q2"]);
  assert.equal(result.perSource[0].duplicates, 0);
});

test("a zero or missing positive mark falls back to the default", () => {
  const result = stackSources<Kind>([
    source("a", ["q1"], { marks: 0 }),
    source("b", ["q2"]),
    source("c", ["q3"], { marks: Number.NaN }),
  ]);
  for (const q of result.questions) assert.equal(q.marks, DEFAULT_SOURCE_MARKS);
});

test("zero negative marking is honoured — only a non-number falls back", () => {
  const result = stackSources<Kind>([
    source("a", ["q1"], { negativeMarks: 0 }),
    source("b", ["q2"]),
  ]);
  assert.equal(result.questions[0].negativeMarks, 0);
  assert.equal(result.questions[1].negativeMarks, DEFAULT_SOURCE_NEGATIVE_MARKS);
});

test("mixed kinds stack together", () => {
  const result = stackSources<Kind>([
    source("doc", ["q1"]),
    { kind: "bag_topic", id: "Physics::Optics", questionIds: ["q2"] },
    { kind: "test", id: "test-1", questionIds: ["q3"] },
  ]);
  assert.deepEqual(result.perSource.map((s) => s.kind), ["import_job", "bag_topic", "test"]);
  assert.equal(result.questions.length, 3);
});

// ── Parsing ──────────────────────────────────────────────────────────────────

test("parseSources keeps only the caller's own kinds", () => {
  const parsed = parseSources(
    [
      { kind: "import_job", id: "a" },
      { kind: "cluster", id: "b" }, // CBT's kind — not the teacher's
      { kind: "bag_topic", id: "c" },
    ],
    TEACHER_TEST_SOURCE_KINDS,
  );
  assert.deepEqual(parsed.map((s) => s.id), ["a", "c"]);
});

test("the CBT wrapper keeps its own vocabulary after the refactor", () => {
  const parsed = parseTestSources([
    { kind: "import_job", id: "a" },
    { kind: "cluster", id: "b" },
    { kind: "bag_topic", id: "c" }, // teacher-only — must not leak into CBT
  ]);
  assert.deepEqual(parsed.map((s) => s.id), ["a", "b"]);
});

test("parseSources drops malformed entries instead of trusting them", () => {
  const parsed = parseSources(
    [
      null,
      "nope",
      { kind: "import_job" }, // no id
      { kind: "import_job", id: "   " }, // blank id
      { id: "no-kind" },
      { kind: "import_job", id: "  ok  " }, // trimmed
    ],
    TEACHER_TEST_SOURCE_KINDS,
  );
  assert.deepEqual(parsed, [{ kind: "import_job", id: "ok", marks: undefined, negativeMarks: undefined }]);
});

test("parseSources tolerates a missing or non-array sources field", () => {
  assert.deepEqual(parseSources(undefined, TEACHER_TEST_SOURCE_KINDS), []);
  assert.deepEqual(parseSources({}, TEACHER_TEST_SOURCE_KINDS), []);
  assert.deepEqual(parseSources("sources", TEACHER_TEST_SOURCE_KINDS), []);
});

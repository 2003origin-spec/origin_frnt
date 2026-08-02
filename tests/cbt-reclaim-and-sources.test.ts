/**
 * CBT identity recovery + multi-source test composition — pure logic.
 *
 *  • pickReclaimCandidates decides whether a student may take an interrupted
 *    attempt back by name. It must never hand over a live session or a
 *    submitted paper.
 *  • stackSources decides the order of a paper assembled from several
 *    documents/clusters, which is what the teacher sees as "the sections came
 *    out in the order I picked them".
 */

import test from "node:test";
import assert from "node:assert/strict";

import { normalizeParticipantName, pickReclaimCandidates, type ReclaimRow } from "@/lib/cbt/reclaim";
import { CBT_PRESENCE_WINDOW_MS } from "@/lib/cbt/finalize-reason";
import { parseTestSources, stackSources, type ResolvedSource } from "@/lib/cbt/source-stack";

const NOW = Date.parse("2026-08-02T10:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function row(overrides: Partial<ReclaimRow> = {}): ReclaimRow {
  return {
    participantId: "p1",
    displayName: "Rahul Sharma",
    studentCode: "CBT-7F3K9Q",
    answeredCount: 30,
    lastSeenAt: iso(14 * 60_000),
    finishedAt: null,
    kicked: false,
    ...overrides,
  };
}

const base = { enteredName: "Rahul Sharma", policy: "name_or_id" as const, now: NOW };

// ── Name normalization ───────────────────────────────────────────────────────

test("names match across case, spacing and unicode width", () => {
  const key = normalizeParticipantName("Rahul Sharma");
  assert.equal(normalizeParticipantName("  rahul   SHARMA "), key);
  assert.equal(normalizeParticipantName("ＲＡＨＵＬ　Ｓｈａｒｍａ"), key);
});

test("an all-whitespace name never matches anything", () => {
  assert.equal(normalizeParticipantName("   "), "");
  assert.deepEqual(pickReclaimCandidates({ ...base, enteredName: "   ", rows: [row()] }), []);
});

// ── Candidate selection ──────────────────────────────────────────────────────

test("an idle unfinished attempt under the same name is offered", () => {
  const candidates = pickReclaimCandidates({ ...base, rows: [row()] });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].studentCode, "CBT-7F3K9Q");
  assert.equal(candidates[0].answeredCount, 30);
});

test("a live session is never offered", () => {
  // Someone is sitting at this machine right now — handing it over would boot
  // them out of their own exam.
  const candidates = pickReclaimCandidates({
    ...base,
    rows: [row({ lastSeenAt: iso(CBT_PRESENCE_WINDOW_MS - 5_000) })],
  });
  assert.deepEqual(candidates, []);
});

test("a submitted paper can never be re-opened", () => {
  assert.deepEqual(
    pickReclaimCandidates({ ...base, rows: [row({ finishedAt: iso(60_000) })] }),
    [],
  );
});

test("a kicked participant is not reclaimable", () => {
  assert.deepEqual(pickReclaimCandidates({ ...base, rows: [row({ kicked: true })] }), []);
});

test("a different name is not offered", () => {
  assert.deepEqual(
    pickReclaimCandidates({ ...base, rows: [row({ displayName: "Priya Nair" })] }),
    [],
  );
});

test("id_only rooms disable name recovery entirely", () => {
  assert.deepEqual(pickReclaimCandidates({ ...base, policy: "id_only", rows: [row()] }), []);
});

test("same-named students are all listed, most progress first", () => {
  const candidates = pickReclaimCandidates({
    ...base,
    rows: [
      row({ participantId: "p1", studentCode: "CBT-AAA111", answeredCount: 4 }),
      row({ participantId: "p2", studentCode: "CBT-BBB222", answeredCount: 31 }),
    ],
  });
  // Ambiguity is surfaced, not guessed at: the student picks their own.
  assert.deepEqual(
    candidates.map((c) => c.studentCode),
    ["CBT-BBB222", "CBT-AAA111"],
  );
});

test("a participant never seen at all is still reclaimable", () => {
  const candidates = pickReclaimCandidates({ ...base, rows: [row({ lastSeenAt: null })] });
  assert.equal(candidates.length, 1);
});

// ── Source stacking ──────────────────────────────────────────────────────────

function source(id: string, questionIds: string[], extra: Partial<ResolvedSource> = {}): ResolvedSource {
  return { kind: "cluster", id, questionIds, ...extra };
}

test("selection order is paper order", () => {
  const { questions } = stackSources([
    source("physics", ["q1", "q2"]),
    source("thermo", ["q3"]),
    source("chem", ["q4", "q5"]),
  ]);
  assert.deepEqual(
    questions.map((q) => q.questionId),
    ["q1", "q2", "q3", "q4", "q5"],
  );
});

test("overlapping sources de-duplicate, first occurrence wins its position", () => {
  const { questions, perSource } = stackSources([
    source("a", ["q1", "q2"]),
    source("b", ["q2", "q3"]),
  ]);
  assert.deepEqual(
    questions.map((q) => q.questionId),
    ["q1", "q2", "q3"],
  );
  assert.equal(questions[1].sourceId, "a", "the earlier source keeps the question");
  assert.deepEqual(perSource, [
    { kind: "cluster", id: "a", added: 2, duplicates: 0 },
    { kind: "cluster", id: "b", added: 1, duplicates: 1 },
  ]);
});

test("marks are applied per source", () => {
  const { questions } = stackSources([
    source("a", ["q1"], { marks: 4, negativeMarks: -1 }),
    source("b", ["q2"], { marks: 3, negativeMarks: 0 }),
  ]);
  assert.deepEqual(questions[0], { questionId: "q1", marks: 4, negativeMarks: -1, sourceId: "a" });
  // 0 is a legitimate choice ("no negative marking") and must survive.
  assert.deepEqual(questions[1], { questionId: "q2", marks: 3, negativeMarks: 0, sourceId: "b" });
});

test("missing or nonsensical marks fall back sensibly", () => {
  const { questions } = stackSources([
    source("a", ["q1"]),
    source("b", ["q2"], { marks: 0, negativeMarks: Number.NaN }),
  ]);
  // A zero-mark question is never intentional; a missing negative is -1.
  assert.equal(questions[0].marks, 4);
  assert.equal(questions[0].negativeMarks, -1);
  assert.equal(questions[1].marks, 4);
  assert.equal(questions[1].negativeMarks, -1);
});

test("an empty source is reported rather than failing the build", () => {
  const { questions, perSource } = stackSources([
    source("empty", []),
    source("a", ["q1"]),
  ]);
  assert.deepEqual(
    questions.map((q) => q.questionId),
    ["q1"],
  );
  assert.equal(perSource[0].added, 0);
});

test("parseTestSources drops malformed entries instead of trusting them", () => {
  const parsed = parseTestSources([
    { kind: "import_job", id: "job1" },
    { kind: "cluster", id: " c1 ", marks: 3 },
    { kind: "nonsense", id: "x" },
    { kind: "cluster", id: "" },
    { kind: "cluster" },
    null,
    "nope",
  ]);
  assert.deepEqual(
    parsed.map((s) => `${s.kind}:${s.id}`),
    ["import_job:job1", "cluster:c1"],
  );
  assert.equal(parsed[1].marks, 3);
});

test("parseTestSources tolerates a missing sources field", () => {
  assert.deepEqual(parseTestSources(undefined), []);
  assert.deepEqual(parseTestSources({}), []);
});

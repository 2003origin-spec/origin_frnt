/**
 * Sectional (per-subject) marking for CBT.
 *
 * The invariants that make the feature trustworthy: sections always sum back to
 * the attempt total and the paper max (so the teacher never sees a breakdown
 * that contradicts the score), casing/whitespace variants of a subject are ONE
 * section, everything unlabelled collapses into a single General bucket, and a
 * question awaiting manual review is never reported as a mistake.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSectionScores,
  canonicalSubjectKey,
  canonicalSubjectLabel,
  hasMeaningfulSections,
  orderedSections,
  parseSectionScores,
  type CbtSectionInput,
} from "@/lib/cbt/sections";

function q(overrides: Partial<CbtSectionInput> & { position: number }): CbtSectionInput {
  return {
    subject: "Physics",
    marks: 4,
    marksAwarded: 4,
    isCorrect: true,
    needsReview: false,
    attempted: true,
    timeSeconds: 0,
    ...overrides,
  };
}

// ── Canonicalization ────────────────────────────────────────────────────────

test("subject casing and whitespace collapse into one section", () => {
  assert.equal(canonicalSubjectKey("Physics"), "physics");
  assert.equal(canonicalSubjectKey("  PHYSICS  "), "physics");
  assert.equal(canonicalSubjectKey("physics"), "physics");
});

test("null, empty and 'general' all become the General bucket", () => {
  for (const raw of [null, undefined, "", "   ", "general", "General", "GENERAL"]) {
    assert.equal(canonicalSubjectKey(raw), "general", `key for ${JSON.stringify(raw)}`);
    assert.equal(canonicalSubjectLabel(raw), "General", `label for ${JSON.stringify(raw)}`);
  }
});

test("a named subject keeps the teacher's own spelling as its label", () => {
  assert.equal(canonicalSubjectLabel("  Organic Chemistry "), "Organic Chemistry");
});

// ── Aggregation ─────────────────────────────────────────────────────────────

test("three subjects produce three sections with correct marks", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics", marksAwarded: 4 }),
    q({ position: 1, subject: "Physics", marksAwarded: -1, isCorrect: false }),
    q({ position: 2, subject: "Chemistry", marksAwarded: 4 }),
    q({ position: 3, subject: "Maths", marksAwarded: 0, attempted: false, isCorrect: false }),
  ]);

  assert.equal(Object.keys(sections).length, 3);
  assert.equal(sections.physics.score, 3);
  assert.equal(sections.physics.maxScore, 8);
  assert.equal(sections.physics.correct, 1);
  assert.equal(sections.physics.wrong, 1);
  assert.equal(sections.chemistry.score, 4);
  assert.equal(sections.maths.score, 0);
  assert.equal(sections.maths.skipped, 1);
});

test("sections sum back to the attempt total and the paper max", () => {
  const questions = [
    q({ position: 0, subject: "Physics", marks: 4, marksAwarded: 4 }),
    q({ position: 1, subject: "physics", marks: 4, marksAwarded: -1, isCorrect: false }),
    q({ position: 2, subject: "Chemistry", marks: 3, marksAwarded: 1.5, isCorrect: false }),
    q({ position: 3, subject: null, marks: 2, marksAwarded: 0, attempted: false, isCorrect: false }),
  ];
  const sections = Object.values(buildSectionScores(questions));

  const expectedScore = questions.reduce((s, x) => s + x.marksAwarded, 0);
  const expectedMax = questions.reduce((s, x) => s + x.marks, 0);
  assert.equal(
    Number(sections.reduce((s, x) => s + x.score, 0).toFixed(3)),
    Number(expectedScore.toFixed(3)),
  );
  assert.equal(sections.reduce((s, x) => s + x.maxScore, 0), expectedMax);
});

test("casing variants merge into one section, keeping the first spelling", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics" }),
    q({ position: 1, subject: "PHYSICS" }),
    q({ position: 2, subject: " physics " }),
  ]);
  assert.equal(Object.keys(sections).length, 1);
  assert.equal(sections.physics.questionCount, 3);
  assert.equal(sections.physics.label, "Physics");
});

test("a paper with no subjects at all is one General section", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: null }),
    q({ position: 1, subject: "" }),
    q({ position: 2, subject: "general" }),
  ]);
  assert.deepEqual(Object.keys(sections), ["general"]);
  assert.equal(sections.general.label, "General");
  assert.equal(sections.general.questionCount, 3);
});

test("named subjects and unlabelled questions coexist", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics" }),
    q({ position: 1, subject: null }),
  ]);
  assert.deepEqual(Object.keys(sections).sort(), ["general", "physics"]);
});

test("a question awaiting review is neither correct nor wrong nor skipped", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics", needsReview: true, isCorrect: false, marksAwarded: 0 }),
  ]);
  assert.equal(sections.physics.needsReview, 1);
  assert.equal(sections.physics.correct, 0);
  assert.equal(sections.physics.wrong, 0);
  assert.equal(sections.physics.skipped, 0);
});

test("accuracy is over ATTEMPTED questions, and 0 when nothing was attempted", () => {
  const attempted = buildSectionScores([
    q({ position: 0, marksAwarded: 4 }),
    q({ position: 1, marksAwarded: -1, isCorrect: false }),
    q({ position: 2, marksAwarded: 0, attempted: false, isCorrect: false }),
  ]);
  // 1 correct of 2 attempted — the skipped one must not drag it to 33%.
  assert.equal(attempted.physics.accuracy, 50);

  const blank = buildSectionScores([
    q({ position: 0, marksAwarded: 0, attempted: false, isCorrect: false }),
  ]);
  assert.equal(blank.physics.accuracy, 0);
});

test("negative marking can take a section below zero rather than clamping", () => {
  const sections = buildSectionScores([
    q({ position: 0, marksAwarded: -1, isCorrect: false }),
    q({ position: 1, marksAwarded: -1, isCorrect: false }),
  ]);
  // Clamping here would make the sections disagree with the total.
  assert.equal(sections.physics.score, -2);
});

test("fractional partial credit does not drift over a long paper", () => {
  const questions = Array.from({ length: 90 }, (_, i) =>
    q({ position: i, marks: 4, marksAwarded: 1.333, isCorrect: false }),
  );
  const sections = buildSectionScores(questions);
  assert.equal(sections.physics.score, Number((1.333 * 90).toFixed(3)));
});

test("a zero-mark question cannot break accuracy or the max", () => {
  const sections = buildSectionScores([q({ position: 0, marks: 0, marksAwarded: 0 })]);
  assert.equal(sections.physics.maxScore, 0);
  assert.equal(sections.physics.accuracy, 100);
});

test("per-section time is the sum of its questions' seconds", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics", timeSeconds: 30 }),
    q({ position: 1, subject: "Physics", timeSeconds: 45 }),
    q({ position: 2, subject: "Chemistry", timeSeconds: 12 }),
  ]);
  assert.equal(sections.physics.timeSeconds, 75);
  assert.equal(sections.chemistry.timeSeconds, 12);
});

test("an empty question list yields no sections", () => {
  assert.deepEqual(buildSectionScores([]), {});
});

// ── Ordering + display rules ────────────────────────────────────────────────

test("sections come back in paper order, not alphabetical", () => {
  const sections = buildSectionScores([
    q({ position: 0, subject: "Physics" }),
    q({ position: 1, subject: "Chemistry" }),
    q({ position: 2, subject: "Biology" }),
  ]);
  assert.deepEqual(
    orderedSections(sections).map((s) => s.label),
    ["Physics", "Chemistry", "Biology"],
  );
});

test("a single-section paper is not worth a breakdown", () => {
  assert.equal(hasMeaningfulSections(buildSectionScores([q({ position: 0 })])), false);
  assert.equal(
    hasMeaningfulSections(
      buildSectionScores([q({ position: 0, subject: "Physics" }), q({ position: 1, subject: "Maths" })]),
    ),
    true,
  );
  assert.equal(hasMeaningfulSections({}), false);
  assert.equal(hasMeaningfulSections(null), false);
});

// ── Round-tripping the JSONB column ─────────────────────────────────────────

test("section scores survive a round trip through the column", () => {
  const built = buildSectionScores([
    q({ position: 0, subject: "Physics", timeSeconds: 30 }),
    q({ position: 1, subject: "Chemistry", marksAwarded: -1, isCorrect: false }),
  ]);
  assert.deepEqual(parseSectionScores(JSON.parse(JSON.stringify(built))), built);
});

test("a legacy '{}' column parses to no sections, not to a crash", () => {
  assert.deepEqual(parseSectionScores({}), {});
  assert.deepEqual(parseSectionScores(null), {});
  assert.deepEqual(parseSectionScores("nonsense"), {});
  assert.deepEqual(parseSectionScores([1, 2]), {});
});

test("a partial column row is filled with safe defaults", () => {
  const parsed = parseSectionScores({ physics: { score: 12 } });
  assert.equal(parsed.physics.score, 12);
  assert.equal(parsed.physics.maxScore, 0);
  assert.equal(parsed.physics.label, "Physics");
  assert.equal(parsed.physics.key, "physics");
});

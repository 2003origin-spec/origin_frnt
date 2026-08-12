/**
 * Phase 2 — full-length selection engine.
 *
 * Drives `buildFullLengthTestSelection` against a SIMULATED bank so the
 * shortfall cascade can be exercised in states the real catalog cannot currently
 * reproduce (a bank WITH numerical questions, a starved Biology stream, an empty
 * subject). Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §4.4.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFullLengthTestSelection,
  buildPolicyOverrides,
  policyOverridesFromPersistedTest,
  type CatalogReader,
} from "../../src/server/assessments/full-test-builder";
import { BIOLOGY_CHAPTER_STREAM, getExamBlueprint } from "../../src/lib/exam-blueprints";

type Row = {
  id: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
};

/**
 * Builds an in-memory bank and returns a CatalogReader over it that honours the
 * same filters the SQL does (subject, difficulties, type, chapters, excludeIds,
 * limit) so the cascade is tested against realistic filtering semantics.
 */
function bankReader(rows: Row[]): CatalogReader & { queries: number } {
  const reader = {
    queries: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sample: async (filters: any) => {
      reader.queries += 1;
      const exclude = new Set<string>(filters.excludeIds ?? []);
      const subjects: string[] | null = filters.subjects ?? null;
      const difficulties: string[] | null = filters.difficulties ?? null;
      const chapters: string[] | null = filters.chapters ?? null;
      const type: string | null = filters.type ?? null;
      const matched = rows.filter((row) => {
        if (exclude.has(row.id)) return false;
        if (subjects && !subjects.includes(row.subject)) return false;
        if (difficulties && !difficulties.includes(row.difficulty)) return false;
        if (chapters && !chapters.includes(row.chapter)) return false;
        if (type && row.questionType !== type) return false;
        return true;
      });
      return matched.slice(0, Math.max(0, filters.limit)).map((row) => ({ ...row }));
    },
    chapters: async (subject: string) => [...new Set(rows.filter((r) => r.subject === subject).map((r) => r.chapter))],
  };
  return reader as CatalogReader & { queries: number };
}

/** A bank with plenty of everything, so no adaptation should ever fire. */
function richBank(): Row[] {
  const rows: Row[] = [];
  const bioChapters = Object.keys(BIOLOGY_CHAPTER_STREAM);
  for (const subject of ["physics", "chemistry", "mathematics", "biology"]) {
    const chapters = subject === "biology" ? bioChapters : [`${subject}-ch1`, `${subject}-ch2`];
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (const questionType of ["mcq", "msq", "numerical"]) {
        for (let i = 0; i < 60; i += 1) {
          rows.push({
            id: `${subject}-${difficulty}-${questionType}-${i}`,
            subject,
            chapter: chapters[i % chapters.length],
            difficulty,
            questionType,
          });
        }
      }
    }
  }
  return rows;
}

/** The bank as it actually is today: MCQ + MSQ only, no numerical. */
function realShapedBank(): Row[] {
  return richBank().filter((row) => row.questionType !== "numerical");
}

// ─── Happy path ──────────────────────────────────────────────────────────────

for (const preset of ["jee-main", "jee-advanced", "neet"] as const) {
  test(`${preset} builds the full blueprint from a rich bank with no adaptations`, async () => {
    const blueprint = getExamBlueprint(preset);
    const planned = blueprint.sections.reduce((sum, s) => sum + s.count, 0);
    const selection = await buildFullLengthTestSelection(
      { preset, seed: "seed-1" },
      bankReader(richBank()),
    );

    assert.equal(selection.totalQuestions, planned);
    assert.deepEqual(selection.adaptations, []);
    assert.equal(selection.durationMinutes, blueprint.durationMinutes);
    assert.equal(
      selection.totalMarks,
      blueprint.sections.reduce((sum, s) => sum + s.count * s.marking.correct, 0),
    );
    // Every section delivered exactly what it planned.
    for (const section of selection.sections) {
      assert.equal(section.count, section.plannedCount, `${section.id} short`);
    }
  });
}

test("no question is ever repeated across sections", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "dupe-check" },
    bankReader(richBank()),
  );
  const ids = selection.questions.map((q) => q.questionId);
  assert.equal(new Set(ids).size, ids.length);
});

test("questions are emitted in blueprint section order with contiguous positions", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "order" },
    bankReader(richBank()),
  );
  selection.questions.forEach((q, index) => assert.equal(q.position, index));
  const sectionOrder = selection.questions.map((q) => q.sectionId);
  const firstSeen: string[] = [];
  for (const id of sectionOrder) {
    if (!firstSeen.includes(id)) firstSeen.push(id);
  }
  // Each section's questions are contiguous — the taker groups on this.
  assert.deepEqual(firstSeen, getExamBlueprint("jee-advanced").sections.map((s) => s.id));
});

test("each question carries its own section's exam marking", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "marks" },
    bankReader(richBank()),
  );
  const bySection = new Map(getExamBlueprint("jee-advanced").sections.map((s) => [s.id, s]));
  for (const question of selection.questions) {
    const section = bySection.get(question.sectionId)!;
    assert.equal(question.marks, section.marking.correct);
    assert.equal(question.negativeMarks, section.marking.incorrect);
  }
  // Section 1 is +3/-1 while Section 3 is +4/0 — the paper is not uniform.
  const s1 = selection.questions.filter((q) => q.sectionId === "physics-1");
  const s3 = selection.questions.filter((q) => q.sectionId === "physics-3");
  assert.equal(s1[0].marks, 3);
  assert.equal(s1[0].negativeMarks, -1);
  assert.equal(s3[0].marks, 4);
  assert.equal(s3[0].negativeMarks, 0);
});

test("the difficulty mix is honoured when the bank can satisfy it", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "mix" },
    bankReader(richBank()),
  );
  const physics = selection.questions.filter((q) => q.sectionId === "physics");
  const counts = { easy: 0, medium: 0, hard: 0 } as Record<string, number>;
  for (const q of physics) counts[q.difficulty] += 1;
  // NEET Physics: 45 at 35/45/20 -> 16/20/9 (see the allocator test).
  assert.deepEqual(counts, { easy: 16, medium: 20, hard: 9 });
});

test("JEE Advanced draws no easy questions even though the bank has them", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "hard-only" },
    bankReader(richBank()),
  );
  assert.equal(selection.questions.filter((q) => q.difficulty === "easy").length, 0);
});

test("NEET Botany and Zoology draw from their own chapter sets", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "streams" },
    bankReader(richBank()),
  );
  for (const q of selection.questions.filter((x) => x.sectionId === "botany")) {
    assert.equal(BIOLOGY_CHAPTER_STREAM[q.chapter], "botany", `${q.chapter} is not a Botany chapter`);
  }
  for (const q of selection.questions.filter((x) => x.sectionId === "zoology")) {
    assert.equal(BIOLOGY_CHAPTER_STREAM[q.chapter], "zoology", `${q.chapter} is not a Zoology chapter`);
  }
});

// ─── Determinism (D7) ────────────────────────────────────────────────────────

test("the same seed rebuilds the identical paper; a different seed does not have to", async () => {
  const a = await buildFullLengthTestSelection({ preset: "jee-main", seed: "s" }, bankReader(richBank()));
  const b = await buildFullLengthTestSelection({ preset: "jee-main", seed: "s" }, bankReader(richBank()));
  assert.deepEqual(
    a.questions.map((q) => q.questionId),
    b.questions.map((q) => q.questionId),
  );
  assert.equal(a.seed, "s");
});

// ─── Cascade: the declared numerical degrade (D1) ────────────────────────────

test("a bank with no numerical questions substitutes MCQs and says so", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-main", seed: "degrade" },
    bankReader(realShapedBank()),
  );

  // The paper is still full size — the substitution is what keeps it whole.
  assert.equal(selection.totalQuestions, 75);
  assert.equal(selection.totalMarks, 300);

  const substituted = selection.adaptations.filter((a) => a.reason === "kind_substituted");
  assert.equal(substituted.length, 3, "one per Section B");
  assert.equal(substituted.reduce((sum, a) => sum + a.affected, 0), 15);
  assert.equal(selection.adaptations.filter((a) => a.reason === "section_short").length, 0);

  // Substituted questions keep the SECTION's marking, not the MCQ default.
  const sectionB = selection.questions.filter((q) => q.sectionId === "physics-b");
  assert.equal(sectionB.length, 5);
  for (const q of sectionB) {
    assert.equal(q.questionType, "mcq");
    assert.equal(q.marks, 4);
    assert.equal(q.negativeMarks, -1);
  }
});

test("JEE Advanced keeps its no-negative marking on substituted numerical questions", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "adv-degrade" },
    bankReader(realShapedBank()),
  );
  assert.equal(selection.totalQuestions, 54);
  const section3 = selection.questions.filter((q) => q.sectionId === "chemistry-3");
  assert.equal(section3.length, 6);
  for (const q of section3) {
    assert.equal(q.negativeMarks, 0, "a substituted numerical must not gain negative marking");
  }
});

// ─── Cascade: difficulty, stream, and giving up ──────────────────────────────

test("a band with too few questions borrows from the mix's other bands", async () => {
  // Physics has only 4 hard MCQs; NEET Physics wants 9.
  const rows = richBank().filter(
    (row) => !(row.subject === "physics" && row.difficulty === "hard") || Number(row.id.split("-").pop()) < 4,
  );
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "borrow" },
    bankReader(rows),
  );
  const physics = selection.questions.filter((q) => q.sectionId === "physics");
  assert.equal(physics.length, 45, "the section must still be complete");
  assert.equal(physics.filter((q) => q.difficulty === "hard").length, 4);
  const relaxed = selection.adaptations.filter(
    (a) => a.sectionId === "physics" && a.reason === "difficulty_relaxed",
  );
  assert.equal(relaxed.length, 1);
  assert.equal(relaxed[0].affected, 5);
});

test("a starved Biology stream crosses over rather than shipping short", async () => {
  // Keep only 10 Botany-chapter rows; Botany needs 45.
  const rows = richBank().filter(
    (row) =>
      row.subject !== "biology" ||
      BIOLOGY_CHAPTER_STREAM[row.chapter] !== "botany" ||
      Number(row.id.split("-").pop()) < 3,
  );
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "starved" },
    bankReader(rows),
  );
  const botany = selection.questions.filter((q) => q.sectionId === "botany");
  assert.equal(botany.length, 45);
  const crossed = selection.adaptations.filter(
    (a) => a.sectionId === "botany" && a.reason === "stream_relaxed",
  );
  assert.equal(crossed.length, 1);
  assert.ok(crossed[0].affected > 0);
  assert.ok(botany.some((q) => BIOLOGY_CHAPTER_STREAM[q.chapter] === "zoology"));
});

test("an exhausted subject ships a short section and reports it instead of throwing", async () => {
  const rows = richBank().filter((row) => row.subject !== "mathematics");
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-main", seed: "empty-maths" },
    bankReader(rows),
  );
  // Physics + Chemistry still complete; Maths contributes nothing.
  assert.equal(selection.totalQuestions, 50);
  assert.equal(selection.questions.filter((q) => q.subject === "mathematics").length, 0);
  const short = selection.adaptations.filter((a) => a.reason === "section_short");
  assert.deepEqual(
    short.map((a) => a.sectionId).sort(),
    ["mathematics-a", "mathematics-b"],
  );
  assert.equal(short.reduce((sum, a) => sum + a.affected, 0), 25);
  // Total marks reflect what was actually built, not the blueprint's ideal.
  assert.equal(selection.totalMarks, 200);
});

test("an entirely empty bank produces an empty paper rather than an exception", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "void" },
    bankReader([]),
  );
  assert.equal(selection.totalQuestions, 0);
  assert.equal(selection.totalMarks, 0);
  assert.equal(selection.adaptations.filter((a) => a.reason === "section_short").length, 4);
});

// ─── Soft exclusions ─────────────────────────────────────────────────────────

test("recently-seen questions are avoided when the bank can afford it", async () => {
  const bank = richBank();
  const avoid = bank
    .filter((r) => r.subject === "physics" && r.difficulty === "easy" && r.questionType === "mcq")
    .slice(0, 10)
    .map((r) => r.id);
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "avoid", softExcludeIds: avoid },
    bankReader(bank),
  );
  const picked = new Set(selection.questions.map((q) => q.questionId));
  assert.equal(avoid.filter((id) => picked.has(id)).length, 0);
});

test("soft exclusions are dropped rather than leaving the paper short", async () => {
  // Only 45 physics MCQs exist and ALL are on the avoid list.
  const bank = richBank().filter(
    (r) => r.subject !== "physics" || (r.questionType === "mcq" && Number(r.id.split("-").pop()) < 15),
  );
  const avoid = bank.filter((r) => r.subject === "physics").map((r) => r.id);
  const selection = await buildFullLengthTestSelection(
    { preset: "neet", seed: "drop-avoid", softExcludeIds: avoid },
    bankReader(bank),
  );
  assert.equal(selection.questions.filter((q) => q.sectionId === "physics").length, 45);
});

// ─── Policy overrides handed to the grader (D4) ──────────────────────────────

test("buildPolicyOverrides turns a built paper into per-question grader policies", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "policies" },
    bankReader(richBank()),
  );
  const partialBySection = new Map(
    selection.sections
      .filter((s) => s.marks.partialPerCorrectOption != null)
      .map((s) => [s.id, s.marks.partialPerCorrectOption!]),
  );
  const overrides = buildPolicyOverrides(selection.questions, partialBySection);

  assert.equal(overrides.size, selection.questions.length);

  const single = selection.questions.find((q) => q.sectionId === "physics-1")!;
  assert.deepEqual(overrides.get(single.questionId), {
    correctMarks: 3,
    incorrectMarks: -1,
    unattemptedMarks: 0,
    partialCreditPolicy: "none",
    negativeMarkingMode: "answered_only",
  });

  const multi = selection.questions.find((q) => q.sectionId === "physics-2")!;
  assert.deepEqual(overrides.get(multi.questionId), {
    correctMarks: 4,
    incorrectMarks: -2,
    unattemptedMarks: 0,
    partialCreditPolicy: "fractional",
    negativeMarkingMode: "answered_only",
    partialCreditMode: "per_correct_option",
    partialUnitMarks: 1,
  });

  const numerical = selection.questions.find((q) => q.sectionId === "physics-3")!;
  assert.equal(overrides.get(numerical.questionId)!.negativeMarkingMode, "none");
});

// ─── Replaying a PERSISTED paper's marking at grade time (Phase 4) ────────────

test("a persisted full-length paper rebuilds its exact per-section marking", async () => {
  const selection = await buildFullLengthTestSelection(
    { preset: "jee-advanced", seed: "persisted" },
    bankReader(richBank()),
  );
  // Exactly what createFullLengthTest persists and getPersistedCustomTest reads back.
  const persisted = {
    examPreset: "jee-advanced",
    questionMarking: selection.questions.map((q) => ({
      questionId: q.questionId,
      sectionId: q.sectionId,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
    })),
    blueprint: { sections: selection.sections } as Record<string, unknown>,
  };

  const overrides = policyOverridesFromPersistedTest(persisted)!;
  assert.ok(overrides);
  assert.equal(overrides.size, 54);

  const single = selection.questions.find((q) => q.sectionId === "chemistry-1")!;
  assert.equal(overrides.get(single.questionId)!.correctMarks, 3);
  assert.equal(overrides.get(single.questionId)!.incorrectMarks, -1);
  assert.equal(overrides.get(single.questionId)!.partialCreditMode, undefined);

  const multi = selection.questions.find((q) => q.sectionId === "chemistry-2")!;
  assert.equal(overrides.get(multi.questionId)!.partialCreditMode, "per_correct_option");
  assert.equal(overrides.get(multi.questionId)!.partialUnitMarks, 1);
  assert.equal(overrides.get(multi.questionId)!.incorrectMarks, -2);

  const numerical = selection.questions.find((q) => q.sectionId === "chemistry-3")!;
  assert.equal(overrides.get(numerical.questionId)!.negativeMarkingMode, "none");
});

test("an ordinary custom test gets NO overrides, so it keeps the platform default", () => {
  // The regression that matters most: every test created before this feature
  // has an empty questionMarking and must grade exactly as it always did.
  assert.equal(policyOverridesFromPersistedTest({ questionMarking: [], blueprint: null }), null);
  assert.equal(policyOverridesFromPersistedTest({ examPreset: null, questionMarking: [], blueprint: {} }), null);
});

test("a paper whose blueprint snapshot is missing still grades on its persisted marks", () => {
  // Defence in depth: marks live on the question rows, so losing the blueprint
  // costs only the partial-credit rule, not the whole mark scheme.
  const overrides = policyOverridesFromPersistedTest({
    examPreset: "jee-advanced",
    questionMarking: [
      { questionId: "q1", sectionId: "physics-1", marks: 3, negativeMarks: -1 },
      { questionId: "q2", sectionId: "physics-2", marks: 4, negativeMarks: -2 },
    ],
    blueprint: null,
  })!;
  assert.equal(overrides.get("q1")!.correctMarks, 3);
  assert.equal(overrides.get("q2")!.incorrectMarks, -2);
  assert.equal(overrides.get("q2")!.partialCreditMode, undefined);
  assert.equal(overrides.get("q2")!.partialCreditPolicy, "none");
});

test("a malformed blueprint section cannot corrupt the mark scheme", () => {
  const overrides = policyOverridesFromPersistedTest({
    examPreset: "jee-advanced",
    questionMarking: [{ questionId: "q1", sectionId: "physics-2", marks: 4, negativeMarks: -2 }],
    blueprint: {
      sections: [
        { id: 42, marks: { partialPerCorrectOption: 1 } },
        { id: "physics-2", marks: { partialPerCorrectOption: "banana" } },
      ],
    },
  })!;
  assert.equal(overrides.get("q1")!.partialCreditMode, undefined);
  assert.equal(overrides.get("q1")!.correctMarks, 4);
});

test("a hand-built teacher test is NOT overridden, so its live grading is unchanged", () => {
  // Teacher tests carry per-question marks (defaulting to 4/-1) but have always
  // graded on the platform policy, which zeroes negative marking for numerical
  // questions. Only papers that declare an exam preset opt into exam marking.
  assert.equal(
    policyOverridesFromPersistedTest({
      examPreset: null,
      questionMarking: [
        { questionId: "q1", sectionId: null, marks: 4, negativeMarks: -1 },
        { questionId: "q2", sectionId: null, marks: 2, negativeMarks: -0.5 },
      ],
      blueprint: null,
    }),
    null,
  );
});

test("a teacher-GENERATED full-length paper does get exam marking", () => {
  const overrides = policyOverridesFromPersistedTest({
    examPreset: "jee-advanced",
    questionMarking: [
      { questionId: "q1", sectionId: "physics-2", marks: 4, negativeMarks: -2 },
      { questionId: "q2", sectionId: "physics-3", marks: 4, negativeMarks: 0 },
    ],
    blueprint: {
      kind: "full_length_mock",
      sections: [{ id: "physics-2", marks: { partialPerCorrectOption: 1 } }],
    },
  })!;
  assert.equal(overrides.get("q1")!.partialCreditMode, "per_correct_option");
  assert.equal(overrides.get("q2")!.negativeMarkingMode, "none");
});

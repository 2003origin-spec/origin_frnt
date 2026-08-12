/**
 * Phase 1 — full-length mock-test blueprints + exam marking.
 * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §4.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_EXAM_PRESETS,
  BIOLOGY_CHAPTER_STREAM,
  DIFFICULTY_BANDS,
  allocateByMix,
  biologyStreamChapters,
  blueprintTotalMarks,
  blueprintTotalQuestions,
  formatMarking,
  getExamBlueprint,
  isExamPresetId,
  summarizeAdaptations,
  type DifficultyMix,
} from "../../src/lib/exam-blueprints";
import {
  computeMarksFromCredit,
  examMarkingToScoringPolicy,
} from "../../src/server/assessment-orchestrator";

// ─── Blueprint shape (§4.1–4.3) ──────────────────────────────────────────────

test("JEE Main is 75 questions / 300 marks / 180 minutes", () => {
  const bp = getExamBlueprint("jee-main");
  assert.equal(blueprintTotalQuestions(bp), 75);
  assert.equal(blueprintTotalMarks(bp), 300);
  assert.equal(bp.durationMinutes, 180);
  // 20 MCQ + 5 numerical per subject, three subjects.
  assert.equal(bp.sections.length, 6);
  assert.deepEqual(
    bp.sections.map((s) => s.count),
    [20, 5, 20, 5, 20, 5],
  );
});

test("JEE Advanced is 54 questions / 198 marks and carries a partial-marking section", () => {
  const bp = getExamBlueprint("jee-advanced");
  assert.equal(blueprintTotalQuestions(bp), 54);
  // 3 subjects x (6x3 + 6x4 + 6x4) = 3 x 66
  assert.equal(blueprintTotalMarks(bp), 198);
  assert.equal(bp.sections.length, 9);

  const msq = bp.sections.filter((s) => s.kind === "msq");
  assert.equal(msq.length, 3);
  for (const section of msq) {
    assert.equal(section.marking.correct, 4);
    assert.equal(section.marking.incorrect, -2);
    assert.equal(section.marking.partialPerCorrectOption, 1);
  }

  // Section 3 is the real exam's no-negative numerical section.
  const numerical = bp.sections.filter((s) => s.kind === "numerical");
  assert.equal(numerical.length, 3);
  for (const section of numerical) {
    assert.equal(section.marking.incorrect, 0);
  }
});

test("NEET is 180 questions / 720 marks with Botany and Zoology as separate sections", () => {
  const bp = getExamBlueprint("neet");
  assert.equal(blueprintTotalQuestions(bp), 180);
  assert.equal(blueprintTotalMarks(bp), 720);
  assert.equal(bp.durationMinutes, 200);
  assert.deepEqual(
    bp.sections.map((s) => s.id),
    ["physics", "chemistry", "botany", "zoology"],
  );
  const bio = bp.sections.filter((s) => s.subject === "biology");
  assert.equal(bio.length, 2);
  assert.deepEqual(bio.map((s) => s.stream).sort(), ["botany", "zoology"]);
  // Biology is 90 of the 180 questions, as in the real paper.
  assert.equal(bio.reduce((sum, s) => sum + s.count, 0), 90);
});

test("every blueprint has unique section ids and only declares its own subjects", () => {
  for (const preset of ALL_EXAM_PRESETS) {
    const bp = getExamBlueprint(preset);
    const ids = bp.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${preset} has duplicate section ids`);
    for (const section of bp.sections) {
      assert.ok(
        bp.subjects.includes(section.subject),
        `${preset} section ${section.id} draws a subject the preset does not declare`,
      );
      assert.ok(section.count > 0, `${preset} section ${section.id} has no questions`);
    }
  }
});

test("JEE presets never draw easy questions; NEET and JEE Main do", () => {
  const advanced = getExamBlueprint("jee-advanced");
  for (const section of advanced.sections) {
    assert.equal(section.difficultyMix.easy ?? 0, 0, `${section.id} should be medium-to-hard only`);
  }
  const main = getExamBlueprint("jee-main");
  assert.ok(main.sections.every((s) => (s.difficultyMix.easy ?? 0) > 0));
  const neet = getExamBlueprint("neet");
  assert.ok(neet.sections.every((s) => (s.difficultyMix.easy ?? 0) > 0));
});

test("isExamPresetId only accepts the three presets", () => {
  assert.ok(isExamPresetId("neet"));
  assert.ok(isExamPresetId("jee-main"));
  assert.ok(isExamPresetId("jee-advanced"));
  assert.equal(isExamPresetId("bitsat"), false);
  assert.equal(isExamPresetId(null), false);
  assert.equal(isExamPresetId(undefined), false);
});

// ─── Difficulty allocation ───────────────────────────────────────────────────

test("allocateByMix always sums to exactly the requested count", () => {
  const mixes: DifficultyMix[] = [
    { easy: 0.3, medium: 0.5, hard: 0.2 },
    { medium: 0.55, hard: 0.45 },
    { easy: 0.35, medium: 0.45, hard: 0.2 },
    { easy: 1 },
  ];
  for (const mix of mixes) {
    for (let count = 0; count <= 60; count += 1) {
      const allocation = allocateByMix(count, mix);
      const total = DIFFICULTY_BANDS.reduce((sum, band) => sum + allocation[band], 0);
      assert.equal(total, count, `mix ${JSON.stringify(mix)} at count ${count}`);
    }
  }
});

test("allocateByMix never assigns a band the mix gives zero weight", () => {
  for (let count = 1; count <= 40; count += 1) {
    const allocation = allocateByMix(count, { medium: 0.55, hard: 0.45 });
    assert.equal(allocation.easy, 0, `count ${count} leaked into the easy band`);
  }
});

test("allocateByMix matches the blueprint proportions on the real section sizes", () => {
  // NEET Physics: 45 questions at 35/45/20.
  assert.deepEqual(allocateByMix(45, { easy: 0.35, medium: 0.45, hard: 0.2 }), {
    easy: 16,
    medium: 20,
    hard: 9,
  });
  // JEE Main Section A: 20 questions at 30/50/20.
  assert.deepEqual(allocateByMix(20, { easy: 0.3, medium: 0.5, hard: 0.2 }), {
    easy: 6,
    medium: 10,
    hard: 4,
  });
  // JEE Advanced section: 6 questions at 55/45.
  assert.deepEqual(allocateByMix(6, { medium: 0.55, hard: 0.45 }), {
    easy: 0,
    medium: 3,
    hard: 3,
  });
});

test("allocateByMix degrades to medium when the mix carries no weight", () => {
  assert.deepEqual(allocateByMix(7, {}), { easy: 0, medium: 7, hard: 0 });
  assert.deepEqual(allocateByMix(0, { easy: 1 }), { easy: 0, medium: 0, hard: 0 });
});

// ─── Biology stream map (D6) ─────────────────────────────────────────────────

test("every mapped Biology chapter belongs to exactly one stream", () => {
  const chapters = Object.keys(BIOLOGY_CHAPTER_STREAM);
  assert.equal(chapters.length, 32, "the bank holds 32 Biology chapters");
  const botany = biologyStreamChapters("botany", chapters);
  const zoology = biologyStreamChapters("zoology", chapters);
  assert.equal(botany.length + zoology.length, chapters.length);
  assert.equal(botany.filter((c) => zoology.includes(c)).length, 0);
});

test("an unmapped chapter is usable by BOTH streams so it can never starve one", () => {
  const chapters = ["Animal Kingdom", "Plant Kingdom", "Some Future Chapter"];
  assert.ok(biologyStreamChapters("botany", chapters).includes("Some Future Chapter"));
  assert.ok(biologyStreamChapters("zoology", chapters).includes("Some Future Chapter"));
  assert.equal(biologyStreamChapters("botany", chapters).includes("Animal Kingdom"), false);
  assert.equal(biologyStreamChapters("zoology", chapters).includes("Plant Kingdom"), false);
});

// ─── Exam marking (D4, D9) ───────────────────────────────────────────────────

const NEET_POLICY = examMarkingToScoringPolicy({ correct: 4, incorrect: -1, unattempted: 0 });
const ADV_MSQ_POLICY = examMarkingToScoringPolicy({
  correct: 4,
  incorrect: -2,
  unattempted: 0,
  partialPerCorrectOption: 1,
});
const ADV_NUMERICAL_POLICY = examMarkingToScoringPolicy({ correct: 4, incorrect: 0, unattempted: 0 });

test("+4/-1 sections score exactly like the real exam", () => {
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: true, policy: NEET_POLICY }),
    4,
  );
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: false, policy: NEET_POLICY }),
    -1,
  );
  assert.equal(
    computeMarksFromCredit({ answered: false, isCorrect: false, policy: NEET_POLICY }),
    0,
  );
});

test("a no-negative section floors a wrong answer at zero, never below", () => {
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: false, policy: ADV_NUMERICAL_POLICY }),
    0,
  );
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: true, policy: ADV_NUMERICAL_POLICY }),
    4,
  );
});

test("JEE Advanced MSQ marking follows the real +4 / +1-per-correct / -2 table", () => {
  // Full correct set (4 correct options, all chosen).
  assert.equal(
    computeMarksFromCredit({ answered: true, isCorrect: true, policy: ADV_MSQ_POLICY, partialUnits: 4 }),
    4,
  );
  // 3 of 4 correct chosen, none wrong -> +3 (NOT 4 x 0.75).
  assert.equal(
    computeMarksFromCredit({
      answered: true,
      isCorrect: false,
      creditAwarded: 0.75,
      policy: ADV_MSQ_POLICY,
      partialUnits: 4,
    }),
    3,
  );
  // 1 of 3 correct chosen, none wrong -> +1 (fractional would give 1.333).
  assert.equal(
    computeMarksFromCredit({
      answered: true,
      isCorrect: false,
      creditAwarded: 1 / 3,
      policy: ADV_MSQ_POLICY,
      partialUnits: 3,
    }),
    1,
  );
  // Any wrong option picked -> credit 0 -> -2.
  assert.equal(
    computeMarksFromCredit({
      answered: true,
      isCorrect: false,
      creditAwarded: 0,
      policy: ADV_MSQ_POLICY,
      partialUnits: 3,
    }),
    -2,
  );
  // Blank -> 0.
  assert.equal(
    computeMarksFromCredit({ answered: false, isCorrect: false, policy: ADV_MSQ_POLICY, partialUnits: 3 }),
    0,
  );
});

test("per-correct-option marking degrades to fractional when the unit count is unknown", () => {
  // Without partialUnits the rule cannot be applied; falling back to fractional
  // beats silently scoring zero.
  assert.equal(
    computeMarksFromCredit({
      answered: true,
      isCorrect: false,
      creditAwarded: 0.5,
      policy: ADV_MSQ_POLICY,
    }),
    2,
  );
});

test("exam marking never leaks the local-only fields onto the grader wire contract", () => {
  // partialCreditPolicy is the only partial field the microservice knows about;
  // the JEE rule rides in partialCreditMode, which toRemotePolicy never maps.
  assert.equal(ADV_MSQ_POLICY.partialCreditPolicy, "fractional");
  assert.equal(ADV_MSQ_POLICY.partialCreditMode, "per_correct_option");
  assert.equal(NEET_POLICY.partialCreditMode, undefined);
  assert.equal(NEET_POLICY.partialCreditPolicy, "none");
});

test("the default platform policy is unchanged by the per-correct-option branch", () => {
  // Regression guard: ordinary tests must keep fractional partial credit.
  const platform = {
    correctMarks: 4,
    incorrectMarks: -1,
    unattemptedMarks: 0,
    partialCreditPolicy: "fractional" as const,
    negativeMarkingMode: "answered_only" as const,
  };
  assert.equal(
    computeMarksFromCredit({
      answered: true,
      isCorrect: false,
      creditAwarded: 0.5,
      policy: platform,
      partialUnits: 4,
    }),
    2,
  );
});

// ─── Adaptation reporting (D1) ───────────────────────────────────────────────

test("summarizeAdaptations names the numerical substitution explicitly", () => {
  const summary = summarizeAdaptations([
    { sectionId: "physics-b", reason: "kind_substituted", affected: 5, detail: "" },
    { sectionId: "chemistry-b", reason: "kind_substituted", affected: 5, detail: "" },
  ]);
  assert.ok(summary);
  assert.match(summary, /10 numerical-type questions were substituted/);
});

test("summarizeAdaptations reports a short paper and returns null when nothing changed", () => {
  const short = summarizeAdaptations([
    { sectionId: "botany", reason: "section_short", affected: 3, detail: "" },
  ]);
  assert.ok(short);
  assert.match(short, /shorter than the real exam/);
  assert.equal(summarizeAdaptations([]), null);
});

test("formatMarking renders the exam's own marks", () => {
  assert.equal(formatMarking({ correct: 4, incorrect: -1, unattempted: 0 }), "+4 / −1");
  assert.equal(formatMarking({ correct: 4, incorrect: 0, unattempted: 0 }), "+4 / 0");
  assert.equal(formatMarking({ correct: 3, incorrect: -1, unattempted: 0 }), "+3 / −1");
});

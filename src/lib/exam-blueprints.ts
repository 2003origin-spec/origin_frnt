/**
 * Full-length mock-test blueprints (JEE Main / JEE Advanced / NEET) — pure,
 * client-safe model.
 *
 * A *blueprint* is the declarative specification of a real exam: its sections,
 * how many questions each holds, which question kind and difficulty mix each
 * draws, and the exam's own marking scheme. Nothing here touches the database,
 * `next/*` or any browser API, so it is safe to import from client components,
 * RSC, route handlers and `node:test` alike — the same pure/DB split
 * `src/lib/study-mode.ts` (pure) / `src/server/study-scope.ts` (DB) uses.
 *
 * The selection engine that turns a blueprint into an actual question set lives
 * in `src/server/assessments/full-test-builder.ts`; the marking-scheme →
 * grader-policy conversion lives in `src/server/assessment-orchestrator.ts`.
 *
 * IMPORTANT — blueprints describe the REAL exam, not what our bank happens to
 * hold today. The bank currently has no integer/numerical-answer questions, so
 * the builder degrades those sections to MCQ and records an adaptation (see
 * `SectionAdaptation`). When numerical questions are seeded the real sections
 * build themselves with no change here.
 *
 * See V1/FULL_LENGTH_MOCK_TESTS_PLAN.md (§4) — the source of truth.
 */

import type { Subject } from "@/lib/entitlements";

export type ExamPresetId = "jee-main" | "jee-advanced" | "neet";

export const ALL_EXAM_PRESETS: ExamPresetId[] = ["jee-main", "jee-advanced", "neet"];

/** Question kind a section draws. Mirrors the catalog's effective question_type. */
export type SectionKind = "mcq" | "msq" | "numerical";

/**
 * Difficulty bands a blueprint reasons in. These are coarser than the catalog's
 * raw `difficulty` column: the `hard` band also absorbs `insane`, which exists
 * on a handful of rows and would otherwise be unreachable by any blueprint.
 */
export type DifficultyBand = "easy" | "medium" | "hard";

export const DIFFICULTY_BANDS: DifficultyBand[] = ["easy", "medium", "hard"];

/** Raw catalog `difficulty` values each band accepts, widest-useful first. */
export const BAND_CATALOG_DIFFICULTIES: Readonly<Record<DifficultyBand, readonly string[]>> = Object.freeze({
  easy: Object.freeze(["easy"]),
  medium: Object.freeze(["medium"]),
  hard: Object.freeze(["hard", "insane"]),
});

/**
 * Fractional weights per band. Need not sum to exactly 1 — `allocateByMix`
 * normalises — but every blueprint here is written to sum to 1 for readability.
 */
export type DifficultyMix = Readonly<Partial<Record<DifficultyBand, number>>>;

/**
 * A section's marking scheme, in the exam's own marks.
 *
 * `partialPerCorrectOption` encodes the JEE Advanced multiple-correct rule: when
 * a student picks a strict, all-correct subset of the answer (no wrong option),
 * they score this much per correct option chosen — NOT a fraction of the full
 * marks. Absent ⇒ no partial credit path for the section.
 */
export type MarkingScheme = {
  correct: number;
  incorrect: number;
  unattempted: number;
  partialPerCorrectOption?: number;
};

export type BlueprintSection = {
  /** Stable id, persisted per question so a taken test can be re-sectioned. */
  id: string;
  /** Student-facing section name, e.g. "Physics — Section A". */
  label: string;
  /** Shorter label used inside the taker's section switcher. */
  shortLabel: string;
  subject: Subject;
  /**
   * NEET splits Biology into Botany and Zoology, which are chapter sets rather
   * than subjects. Null for every non-split section.
   */
  stream: BiologyStream | null;
  kind: SectionKind;
  count: number;
  marking: MarkingScheme;
  difficultyMix: DifficultyMix;
};

export type ExamBlueprint = {
  id: ExamPresetId;
  label: string;
  /** One-line description shown on the preset card. */
  blurb: string;
  /** Subjects a student must be entitled to before the preset is offered (D2). */
  subjects: readonly Subject[];
  durationMinutes: number;
  sections: readonly BlueprintSection[];
};

// ─── Marking schemes ─────────────────────────────────────────────────────────

/** JEE Main + NEET: +4 correct, −1 wrong, 0 unattempted. */
const PLUS4_MINUS1: MarkingScheme = { correct: 4, incorrect: -1, unattempted: 0 };

/** JEE Advanced single-correct section: +3 / −1. */
const PLUS3_MINUS1: MarkingScheme = { correct: 3, incorrect: -1, unattempted: 0 };

/**
 * JEE Advanced multiple-correct section: +4 for the full correct set, +1 for
 * each correct option chosen when the selection is a strict all-correct subset,
 * −2 the moment any wrong option is picked, 0 for a blank.
 */
const JEE_ADVANCED_MSQ: MarkingScheme = {
  correct: 4,
  incorrect: -2,
  unattempted: 0,
  partialPerCorrectOption: 1,
};

/** JEE Advanced numerical section: +4, no negative marking. */
const PLUS4_NO_NEGATIVE: MarkingScheme = { correct: 4, incorrect: 0, unattempted: 0 };

// ─── Difficulty mixes ────────────────────────────────────────────────────────

/** "Easy to medium with some hard" — JEE Main main sections. */
const MIX_JEE_MAIN: DifficultyMix = Object.freeze({ easy: 0.3, medium: 0.5, hard: 0.2 });

/** JEE Main Section B skews harder — it is the discriminating section. */
const MIX_JEE_MAIN_SECTION_B: DifficultyMix = Object.freeze({ easy: 0.2, medium: 0.5, hard: 0.3 });

/** "Medium to hard" — JEE Advanced throughout. No easy questions at all. */
const MIX_JEE_ADVANCED: DifficultyMix = Object.freeze({ medium: 0.55, hard: 0.45 });

/** JEE Advanced numerical section leans hardest. */
const MIX_JEE_ADVANCED_NUMERICAL: DifficultyMix = Object.freeze({ medium: 0.5, hard: 0.5 });

/** "A mix of all types" — NEET. */
const MIX_NEET: DifficultyMix = Object.freeze({ easy: 0.35, medium: 0.45, hard: 0.2 });

// ─── Biology streams (NEET Botany / Zoology split, D6) ───────────────────────

export type BiologyStream = "botany" | "zoology";

/**
 * Chapter → NEET stream map, following NTA's own Botany/Zoology division
 * (genetics, biotechnology, ecology and cell biology sit under Botany).
 *
 * Every one of the 32 Biology chapters currently in the bank is mapped. A
 * chapter absent from this map is deliberately usable by EITHER stream (see
 * `biologyStreamChapters`), so a future import can never starve a section by
 * arriving unmapped.
 */
export const BIOLOGY_CHAPTER_STREAM: Readonly<Record<string, BiologyStream>> = Object.freeze({
  // Botany
  "Anatomy of Flowering Plants": "botany",
  "Biodiversity and its Conservation": "botany",
  "Biological Classification": "botany",
  "Biomolecules": "botany",
  "Biotechnology - Principles and Processes": "botany",
  "Biotechnology and its Applications": "botany",
  "Cell Cycle and Cell Division": "botany",
  "Cell-The Unit of Life": "botany",
  "Ecosystem": "botany",
  "Microbes in Human Welfare": "botany",
  "Molecular Basis of Inheritance": "botany",
  "Morphology of Flowering Plants": "botany",
  "Organisms and Populations": "botany",
  "Photosynthesis in Higher Plants": "botany",
  "Plant - Growth and Development": "botany",
  "Plant Kingdom": "botany",
  "Principles of Inheritance and Variation": "botany",
  "Respiration in Plants": "botany",
  "Sexual Reproduction in Flowering Plants": "botany",
  "The Living World": "botany",
  // Zoology
  "Animal Kingdom": "zoology",
  "Body Fluids and Circulation": "zoology",
  "Breathing and Exchange of Gases": "zoology",
  "Chemical Coordination and Integration": "zoology",
  "Evolution": "zoology",
  "Excretory Products and their Elimination": "zoology",
  "Human Health and Diseases": "zoology",
  "Human Reproduction": "zoology",
  "Locomotion and Movement": "zoology",
  "Neural Control and Coordination": "zoology",
  "Reproductive Health": "zoology",
  "Structural Organisation in Animals": "zoology",
});

/**
 * Chapters a stream may draw from, given the chapters actually present in the
 * bank. Mapped chapters go to their stream; UNMAPPED chapters go to both, so an
 * unrecognised chapter widens the pool instead of shrinking it.
 */
export function biologyStreamChapters(stream: BiologyStream, availableChapters: readonly string[]): string[] {
  return availableChapters.filter((chapter) => {
    const mapped = BIOLOGY_CHAPTER_STREAM[chapter];
    return mapped === undefined || mapped === stream;
  });
}

// ─── Blueprint construction helpers ──────────────────────────────────────────

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
  biology: "Biology",
};

function section(input: {
  id: string;
  label: string;
  shortLabel: string;
  subject: Subject;
  stream?: BiologyStream | null;
  kind: SectionKind;
  count: number;
  marking: MarkingScheme;
  difficultyMix: DifficultyMix;
}): BlueprintSection {
  return {
    id: input.id,
    label: input.label,
    shortLabel: input.shortLabel,
    subject: input.subject,
    stream: input.stream ?? null,
    kind: input.kind,
    count: input.count,
    marking: input.marking,
    difficultyMix: input.difficultyMix,
  };
}

// ─── The three blueprints (§4 of the plan) ───────────────────────────────────

const JEE_SUBJECTS: readonly Subject[] = Object.freeze<Subject[]>(["physics", "chemistry", "mathematics"]);
const NEET_SUBJECTS: readonly Subject[] = Object.freeze<Subject[]>(["physics", "chemistry", "biology"]);

/** JEE Main — 75 Q · 300 marks · 180 min. Section B is numerical in the real exam. */
const JEE_MAIN: ExamBlueprint = {
  id: "jee-main",
  label: "JEE Main",
  blurb: "Full paper — 75 questions across Physics, Chemistry and Mathematics.",
  subjects: JEE_SUBJECTS,
  durationMinutes: 180,
  sections: Object.freeze(
    JEE_SUBJECTS.flatMap((subject) => [
      section({
        id: `${subject}-a`,
        label: `${SUBJECT_LABEL[subject]} — Section A`,
        shortLabel: `${SUBJECT_LABEL[subject]} A`,
        subject,
        kind: "mcq",
        count: 20,
        marking: PLUS4_MINUS1,
        difficultyMix: MIX_JEE_MAIN,
      }),
      section({
        id: `${subject}-b`,
        label: `${SUBJECT_LABEL[subject]} — Section B`,
        shortLabel: `${SUBJECT_LABEL[subject]} B`,
        subject,
        kind: "numerical",
        count: 5,
        marking: PLUS4_MINUS1,
        difficultyMix: MIX_JEE_MAIN_SECTION_B,
      }),
    ]),
  ),
};

/** JEE Advanced — 54 Q · 198 marks · 180 min (Paper-1 shape, D3). */
const JEE_ADVANCED: ExamBlueprint = {
  id: "jee-advanced",
  label: "JEE Advanced",
  blurb: "Paper 1 shape — 54 questions, multiple-correct and partial marking.",
  subjects: JEE_SUBJECTS,
  durationMinutes: 180,
  sections: Object.freeze(
    JEE_SUBJECTS.flatMap((subject) => [
      section({
        id: `${subject}-1`,
        label: `${SUBJECT_LABEL[subject]} — Section 1 (Single Correct)`,
        shortLabel: `${SUBJECT_LABEL[subject]} 1`,
        subject,
        kind: "mcq",
        count: 6,
        marking: PLUS3_MINUS1,
        difficultyMix: MIX_JEE_ADVANCED,
      }),
      section({
        id: `${subject}-2`,
        label: `${SUBJECT_LABEL[subject]} — Section 2 (Multiple Correct)`,
        shortLabel: `${SUBJECT_LABEL[subject]} 2`,
        subject,
        kind: "msq",
        count: 6,
        marking: JEE_ADVANCED_MSQ,
        difficultyMix: MIX_JEE_ADVANCED,
      }),
      section({
        id: `${subject}-3`,
        label: `${SUBJECT_LABEL[subject]} — Section 3 (Numerical)`,
        shortLabel: `${SUBJECT_LABEL[subject]} 3`,
        subject,
        kind: "numerical",
        count: 6,
        marking: PLUS4_NO_NEGATIVE,
        difficultyMix: MIX_JEE_ADVANCED_NUMERICAL,
      }),
    ]),
  ),
};

/** NEET — 180 Q · 720 marks · 200 min, with Biology split into Botany + Zoology. */
const NEET: ExamBlueprint = {
  id: "neet",
  label: "NEET",
  blurb: "Full paper — 180 questions across Physics, Chemistry, Botany and Zoology.",
  subjects: NEET_SUBJECTS,
  durationMinutes: 200,
  sections: Object.freeze([
    section({
      id: "physics",
      label: "Physics",
      shortLabel: "Physics",
      subject: "physics",
      kind: "mcq",
      count: 45,
      marking: PLUS4_MINUS1,
      difficultyMix: MIX_NEET,
    }),
    section({
      id: "chemistry",
      label: "Chemistry",
      shortLabel: "Chemistry",
      subject: "chemistry",
      kind: "mcq",
      count: 45,
      marking: PLUS4_MINUS1,
      difficultyMix: MIX_NEET,
    }),
    section({
      id: "botany",
      label: "Botany",
      shortLabel: "Botany",
      subject: "biology",
      stream: "botany",
      kind: "mcq",
      count: 45,
      marking: PLUS4_MINUS1,
      difficultyMix: MIX_NEET,
    }),
    section({
      id: "zoology",
      label: "Zoology",
      shortLabel: "Zoology",
      subject: "biology",
      stream: "zoology",
      kind: "mcq",
      count: 45,
      marking: PLUS4_MINUS1,
      difficultyMix: MIX_NEET,
    }),
  ]),
};

export const EXAM_BLUEPRINTS: Readonly<Record<ExamPresetId, ExamBlueprint>> = Object.freeze({
  "jee-main": JEE_MAIN,
  "jee-advanced": JEE_ADVANCED,
  neet: NEET,
});

export function isExamPresetId(value: unknown): value is ExamPresetId {
  return typeof value === "string" && (ALL_EXAM_PRESETS as string[]).includes(value);
}

export function getExamBlueprint(preset: ExamPresetId): ExamBlueprint {
  return EXAM_BLUEPRINTS[preset];
}

// ─── Derived totals ──────────────────────────────────────────────────────────

export function blueprintTotalQuestions(blueprint: ExamBlueprint): number {
  return blueprint.sections.reduce((sum, s) => sum + s.count, 0);
}

export function blueprintTotalMarks(blueprint: ExamBlueprint): number {
  return blueprint.sections.reduce((sum, s) => sum + s.count * s.marking.correct, 0);
}

/**
 * The exam's own marking, as a student-readable string ("+4 / −1"). Uses a real
 * minus sign so it reads correctly next to the marks in the taker UI.
 */
export function formatMarking(marking: MarkingScheme): string {
  const negative = marking.incorrect === 0 ? "0" : `−${Math.abs(marking.incorrect)}`;
  return `+${marking.correct} / ${negative}`;
}

// ─── Difficulty allocation ───────────────────────────────────────────────────

/**
 * Split `count` questions across difficulty bands according to `mix`, using
 * largest-remainder (Hare) apportionment so the parts sum to EXACTLY `count` —
 * naive rounding would drift and leave a section short or over-full.
 *
 * Bands are considered in `DIFFICULTY_BANDS` order and ties on the remainder go
 * to the earlier (easier) band, so the result is fully deterministic. A mix
 * whose weights are all zero/absent falls back to putting everything in
 * `medium`, which is the only band every subject in the bank is guaranteed to
 * have.
 */
export function allocateByMix(count: number, mix: DifficultyMix): Record<DifficultyBand, number> {
  const result: Record<DifficultyBand, number> = { easy: 0, medium: 0, hard: 0 };
  const target = Math.max(0, Math.trunc(count));
  if (target === 0) return result;

  const weights = DIFFICULTY_BANDS.map((band) => Math.max(0, mix[band] ?? 0));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    result.medium = target;
    return result;
  }

  const exact = weights.map((w) => (w / totalWeight) * target);
  const floors = exact.map((value) => Math.floor(value));
  let assigned = floors.reduce((sum, value) => sum + value, 0);

  // Hand out the leftover one at a time, largest fractional remainder first.
  const remainders = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const counts = [...floors];
  let cursor = 0;
  while (assigned < target && remainders.length > 0) {
    counts[remainders[cursor % remainders.length].index] += 1;
    assigned += 1;
    cursor += 1;
  }

  DIFFICULTY_BANDS.forEach((band, index) => {
    result[band] = counts[index];
  });
  return result;
}

// ─── Adaptations (the honest degrade path, D1) ───────────────────────────────

export type AdaptationReason =
  /** Borrowed from an adjacent difficulty band inside the same subject. */
  | "difficulty_relaxed"
  /** Substituted a different question kind (numerical → MCQ, MSQ → MCQ). */
  | "kind_substituted"
  /** NEET only: drew from the other Biology stream. */
  | "stream_relaxed"
  /** Could not be filled at all — the section ships smaller than the blueprint. */
  | "section_short";

export type SectionAdaptation = {
  sectionId: string;
  reason: AdaptationReason;
  /** How many questions in this section were affected. */
  affected: number;
  /** Student-facing one-liner. */
  detail: string;
};

/**
 * Collapse a test's adaptations into the single sentence shown as a banner. The
 * kind substitution is the one students most need told (a "numerical" section
 * full of MCQs), so it is reported first and by name.
 */
export function summarizeAdaptations(adaptations: readonly SectionAdaptation[]): string | null {
  if (adaptations.length === 0) return null;

  const substituted = adaptations.filter((a) => a.reason === "kind_substituted");
  const short = adaptations.filter((a) => a.reason === "section_short");
  const parts: string[] = [];

  if (substituted.length > 0) {
    const affected = substituted.reduce((sum, a) => sum + a.affected, 0);
    parts.push(
      `${affected} numerical-type ${affected === 1 ? "question was" : "questions were"} substituted with multiple-choice questions — the integer-answer bank is still being built.`,
    );
  }
  if (short.length > 0) {
    const affected = short.reduce((sum, a) => sum + a.affected, 0);
    parts.push(`${affected} ${affected === 1 ? "question" : "questions"} could not be sourced, so this paper is shorter than the real exam.`);
  }
  if (parts.length === 0) {
    parts.push("Some questions were drawn from an adjacent difficulty band to complete this paper.");
  }
  return parts.join(" ");
}

/**
 * Full-length mock-test selection engine.
 *
 * Turns a declarative `ExamBlueprint` (V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §4)
 * into a concrete, ordered question set drawn from the OG Code catalog, with the
 * exam's own per-question marking attached and an honest record of anywhere the
 * bank could not satisfy the blueprint.
 *
 * Design notes:
 *  - **Sections are drawn in blueprint order** and questions are emitted in that
 *    order, so the taker's existing subject grouping (`TestInterface`) renders
 *    the paper as the real exam's sections without any reordering.
 *  - **No question is ever repeated** inside one paper: a global `seen` set is
 *    threaded through every draw.
 *  - **Shortfalls degrade, they never throw.** Each relaxation step records a
 *    `SectionAdaptation`, which the UI surfaces to the student rather than
 *    silently shipping a paper that is not what it claims to be (D1).
 *  - **Nothing here is student-specific** beyond the seed and the soft exclude
 *    list, so the same engine backs both the student presets and the teacher
 *    generator.
 */

import {
  BAND_CATALOG_DIFFICULTIES,
  DIFFICULTY_BANDS,
  allocateByMix,
  biologyStreamChapters,
  getExamBlueprint,
  type BlueprintSection,
  type DifficultyBand,
  type ExamBlueprint,
  type ExamPresetId,
  type SectionAdaptation,
} from "@/lib/exam-blueprints";
import type { GraderScoringPolicy } from "@/server/grader-client";
import {
  listOgcodeCatalogChapters,
  sampleOgcodeCatalogQuestionIds,
  type CatalogSampleRow,
} from "@/server/ogcode-catalog";

/** One placed question, carrying everything persistence and grading need. */
export type BuiltQuestion = {
  questionId: string;
  sectionId: string;
  /** 0-based position in the whole paper. */
  position: number;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
  /** The exam's marks for a correct answer in this section. */
  marks: number;
  /** The exam's marks for a wrong answer (0 or negative). */
  negativeMarks: number;
};

export type BuiltSection = {
  id: string;
  label: string;
  shortLabel: string;
  subject: string;
  stream: string | null;
  /** The kind the blueprint asked for. */
  kind: string;
  /** How many the blueprint asked for. */
  plannedCount: number;
  /** How many were actually placed. */
  count: number;
  marks: { correct: number; incorrect: number; unattempted: number; partialPerCorrectOption?: number };
};

export type FullTestSelection = {
  preset: ExamPresetId;
  blueprintLabel: string;
  durationMinutes: number;
  /** Paper-ordered questions. */
  questions: BuiltQuestion[];
  sections: BuiltSection[];
  adaptations: SectionAdaptation[];
  totalQuestions: number;
  /** Sum of `marks` over the questions actually placed. */
  totalMarks: number;
  /** The seed the paper was drawn with — reproduces this exact selection. */
  seed: string;
};

export type BuildFullTestInput = {
  preset: ExamPresetId;
  /**
   * Deterministic draw key. The same seed against an unchanged bank rebuilds the
   * identical paper, which is what makes a generated test debuggable.
   */
  seed: string;
  /**
   * Questions to avoid if possible — typically the student's recent attempts.
   * Honoured on the primary draw and on the first relaxation, then dropped, so
   * freshness never costs a student a complete paper.
   */
  softExcludeIds?: readonly string[];
};

/**
 * The two catalog reads this engine performs, injectable so the cascade can be
 * unit-tested against a simulated bank (including starvation cases the real bank
 * cannot currently reproduce). Production callers omit it and get the real
 * catalog.
 */
export type CatalogReader = {
  sample: typeof sampleOgcodeCatalogQuestionIds;
  chapters: typeof listOgcodeCatalogChapters;
};

const DEFAULT_READER: CatalogReader = {
  sample: sampleOgcodeCatalogQuestionIds,
  chapters: listOgcodeCatalogChapters,
};

/** Bands the mix actually asks for, in easy→hard order. */
function mixBands(section: BlueprintSection): DifficultyBand[] {
  return DIFFICULTY_BANDS.filter((band) => (section.difficultyMix[band] ?? 0) > 0);
}

function catalogDifficultiesFor(bands: readonly DifficultyBand[]): string[] {
  return bands.flatMap((band) => [...BAND_CATALOG_DIFFICULTIES[band]]);
}

/**
 * Chapter constraint for a section. Only NEET's Biology sections have one; every
 * other section draws from the whole subject.
 */
async function sectionChapters(
  section: BlueprintSection,
  reader: CatalogReader,
): Promise<string[] | undefined> {
  if (!section.stream) return undefined;
  const available = await reader.chapters(section.subject);
  const chapters = biologyStreamChapters(section.stream, available);
  // An empty result would filter to nothing; treat it as "no constraint" so a
  // bank with unexpected chapter naming still produces a paper.
  return chapters.length ? chapters : undefined;
}

export async function buildFullLengthTestSelection(
  input: BuildFullTestInput,
  reader: CatalogReader = DEFAULT_READER,
): Promise<FullTestSelection> {
  const blueprint: ExamBlueprint = getExamBlueprint(input.preset);
  const seen = new Set<string>();
  const softExclude = new Set(input.softExcludeIds ?? []);
  const questions: BuiltQuestion[] = [];
  const sections: BuiltSection[] = [];
  const adaptations: SectionAdaptation[] = [];

  /**
   * Per-section results, assembled back into blueprint order at the end.
   * Sections are built concurrently across subjects (see below), so they do not
   * finish in blueprint order.
   */
  const results = new Map<string, { picked: CatalogSampleRow[]; adaptations: SectionAdaptation[] }>();

  const buildSection = async (section: BlueprintSection): Promise<void> => {
    const localAdaptations: SectionAdaptation[] = [];
    const chapters = await sectionChapters(section, reader);
    const bands = mixBands(section);
    const allocation = allocateByMix(section.count, section.difficultyMix);
    const picked: CatalogSampleRow[] = [];

    /** Draw up to `want` rows under `filters`, honouring the global seen set. */
    const draw = async (
      want: number,
      filters: {
        type?: string;
        difficulties?: string[];
        chapters?: string[];
        applySoftExclude: boolean;
      },
    ): Promise<CatalogSampleRow[]> => {
      if (want <= 0) return [];
      const exclude = filters.applySoftExclude ? [...seen, ...softExclude] : [...seen];
      const rows = await reader.sample({
        subjects: [section.subject],
        type: filters.type,
        difficulties: filters.difficulties,
        chapters: filters.chapters,
        excludeIds: exclude,
        seed: `${input.seed}:${section.id}`,
        limit: want,
      });
      const fresh = rows.filter((row) => !seen.has(row.id));
      for (const row of fresh) {
        seen.add(row.id);
        picked.push(row);
      }
      return fresh;
    };

    const remaining = () => section.count - picked.length;

    /**
     * Is this section's question kind present for this subject AT ALL?
     *
     * Steps A–D all filter on `section.kind`, so when the bank holds none of
     * that kind they are five guaranteed-empty round trips before the
     * substitution in Step E does the real work — which is exactly the state the
     * bank is in for every numerical section today. One unfiltered `LIMIT 1`
     * probe settles it exactly (no heuristic: if the kind does not exist for the
     * subject, no narrower filter can find it), turning ~5 wasted queries per
     * numerical section into 1.
     */
    const kindAvailable =
      section.kind === "mcq" ||
      (await reader.sample({
        subjects: [section.subject],
        type: section.kind,
        seed: input.seed,
        limit: 1,
      })).length > 0;

    // ── Step A — the blueprint as written: exact kind, exact difficulty band.
    //    Bands filter on disjoint difficulty values, so the draws cannot collide
    //    and are issued concurrently; results are folded back in band order so
    //    the paper stays deterministic for a given seed.
    if (kindAvailable) {
      const exclude = [...seen, ...softExclude];
      const perBand = await Promise.all(
        bands.map(async (band) => {
          const want = allocation[band];
          if (want <= 0) return [] as CatalogSampleRow[];
          return reader.sample({
            subjects: [section.subject],
            type: section.kind,
            difficulties: catalogDifficultiesFor([band]),
            chapters,
            excludeIds: exclude,
            seed: `${input.seed}:${section.id}`,
            limit: want,
          });
        }),
      );
      for (const rows of perBand) {
        for (const row of rows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          picked.push(row);
        }
      }
    }

    // ── Step B — difficulty relaxed WITHIN the mix (a short hard band borrows
    //    from medium). Still honours "medium to hard" for JEE Advanced.
    let relaxedForDifficulty = 0;
    if (kindAvailable && remaining() > 0) {
      const before = picked.length;
      await draw(remaining(), {
        type: section.kind,
        difficulties: catalogDifficultiesFor(bands),
        chapters,
        applySoftExclude: true,
      });
      relaxedForDifficulty += picked.length - before;
    }

    // ── Step C — difficulty dropped entirely (and the soft-exclude list with
    //    it): a complete paper beats a perfectly-calibrated incomplete one.
    if (kindAvailable && remaining() > 0) {
      const before = picked.length;
      await draw(remaining(), { type: section.kind, chapters, applySoftExclude: false });
      relaxedForDifficulty += picked.length - before;
    }
    if (relaxedForDifficulty > 0) {
      localAdaptations.push({
        sectionId: section.id,
        reason: "difficulty_relaxed",
        affected: relaxedForDifficulty,
        detail: `${relaxedForDifficulty} question(s) in ${section.label} came from an adjacent difficulty band.`,
      });
    }

    // ── Step D — NEET only: cross the Botany/Zoology line rather than ship a
    //    short Biology section.
    if (kindAvailable && remaining() > 0 && chapters) {
      const before = picked.length;
      await draw(remaining(), { type: section.kind, applySoftExclude: false });
      const affected = picked.length - before;
      if (affected > 0) {
        localAdaptations.push({
          sectionId: section.id,
          reason: "stream_relaxed",
          affected,
          detail: `${affected} question(s) in ${section.label} came from the other Biology stream.`,
        });
      }
    }

    // ── Step E — the declared degrade (D1): substitute MCQs for a kind the bank
    //    cannot supply. This is what fills JEE's numerical sections today.
    if (remaining() > 0 && section.kind !== "mcq") {
      const before = picked.length;
      await draw(remaining(), {
        type: "mcq",
        difficulties: catalogDifficultiesFor(bands),
        chapters,
        applySoftExclude: true,
      });
      if (remaining() > 0) {
        await draw(remaining(), { type: "mcq", applySoftExclude: false });
      }
      const affected = picked.length - before;
      if (affected > 0) {
        localAdaptations.push({
          sectionId: section.id,
          reason: "kind_substituted",
          affected,
          detail: `${affected} ${section.kind} question(s) in ${section.label} were substituted with multiple-choice questions.`,
        });
      }
    }

    // ── Step F — give up honestly. The section ships smaller and says so.
    if (remaining() > 0) {
      localAdaptations.push({
        sectionId: section.id,
        reason: "section_short",
        affected: remaining(),
        detail: `${section.label} is ${remaining()} question(s) short — the bank could not supply enough.`,
      });
    }

    results.set(section.id, { picked, adaptations: localAdaptations });
  };

  /**
   * Sections are built concurrently PER SUBJECT: two sections of the same
   * subject can compete for the same rows, so they must run in order and see
   * each other's `seen` additions, but sections of different subjects can never
   * collide (a question has exactly one subject). This turns the dominant cost —
   * network round trips to Neon — from serial into one wave per subject.
   */
  const bySubject = new Map<string, BlueprintSection[]>();
  for (const section of blueprint.sections) {
    const group = bySubject.get(section.subject);
    if (group) group.push(section);
    else bySubject.set(section.subject, [section]);
  }
  await Promise.all(
    [...bySubject.values()].map(async (group) => {
      for (const section of group) {
        await buildSection(section);
      }
    }),
  );

  // Assemble in blueprint order — concurrency above means completion order is
  // not blueprint order, and the taker relies on sections being contiguous.
  for (const section of blueprint.sections) {
    const result = results.get(section.id);
    const picked = result?.picked ?? [];
    adaptations.push(...(result?.adaptations ?? []));
    for (const row of picked) {
      questions.push({
        questionId: row.id,
        sectionId: section.id,
        position: questions.length,
        subject: row.subject,
        chapter: row.chapter,
        difficulty: row.difficulty,
        questionType: row.questionType,
        marks: section.marking.correct,
        negativeMarks: section.marking.incorrect,
      });
    }
    sections.push({
      id: section.id,
      label: section.label,
      shortLabel: section.shortLabel,
      subject: section.subject,
      stream: section.stream,
      kind: section.kind,
      plannedCount: section.count,
      count: picked.length,
      marks: { ...section.marking },
    });
  }

  return {
    preset: blueprint.id,
    blueprintLabel: blueprint.label,
    durationMinutes: blueprint.durationMinutes,
    questions,
    sections,
    adaptations,
    totalQuestions: questions.length,
    totalMarks: questions.reduce((sum, q) => sum + q.marks, 0),
    seed: input.seed,
  };
}

/** The `policyOverrides` shape `buildAnalyticsAttempts` consumes. */
export type ExamPolicyOverrides = Map<string, GraderScoringPolicy>;

/**
 * Per-question scoring policies for a paper, keyed by question id.
 *
 * Kept here so the student path, the teacher path and the grader all derive
 * marking from ONE place (D4). Two numbers cannot express the JEE Advanced
 * multiple-correct rule (+1 per correct option), so that rides in
 * `partialBySection`, matched to questions by their section id.
 */
export function buildPolicyOverrides(
  rows: readonly { questionId: string; sectionId?: string | null; marks: number; negativeMarks: number }[],
  /** Marks-per-correct-option, for the sections that award partial credit. */
  partialBySection?: ReadonlyMap<string, number>,
): ExamPolicyOverrides {
  const overrides: ExamPolicyOverrides = new Map();
  for (const row of rows) {
    const partial = row.sectionId ? partialBySection?.get(row.sectionId) : undefined;
    overrides.set(row.questionId, {
      correctMarks: row.marks,
      incorrectMarks: row.negativeMarks,
      unattemptedMarks: 0,
      partialCreditPolicy: partial == null ? "none" : "fractional",
      // A section the exam gives no negative marking must floor at zero rather
      // than fall through to the platform's −1.
      negativeMarkingMode: row.negativeMarks === 0 ? "none" : "answered_only",
      ...(partial == null ? {} : { partialCreditMode: "per_correct_option" as const, partialUnitMarks: partial }),
    });
  }
  return overrides;
}

/**
 * Rebuild the scoring policies of a PERSISTED full-length paper.
 *
 * Deliberately reads the blueprint SNAPSHOT stored with the test rather than the
 * live blueprint: a mock taken today must keep grading the way it was generated,
 * even after the blueprint constants move on.
 *
 * Returns `null` unless the test declares itself a full-length mock
 * (`examPreset`). That discriminator — not merely "has per-question marks" — is
 * what keeps this change surgical:
 *
 *  - free-form custom tests carry no marks at all, and
 *  - hand-built TEACHER tests DO carry per-question marks (defaulting to 4/−1),
 *    but they have always graded on the platform policy, which zeroes negative
 *    marking for numerical questions. Overriding them here would silently change
 *    the score of live, already-assigned teacher tests.
 *
 * Only papers generated from a blueprint opt in.
 */
export function policyOverridesFromPersistedTest(test: {
  examPreset?: string | null;
  questionMarking: readonly { questionId: string; sectionId: string | null; marks: number; negativeMarks: number }[];
  blueprint: Record<string, unknown> | null;
}): ExamPolicyOverrides | null {
  if (!test.examPreset) return null;
  if (!test.questionMarking.length) return null;

  const partialBySection = new Map<string, number>();
  const sections = test.blueprint?.sections;
  if (Array.isArray(sections)) {
    for (const section of sections as Array<{ id?: unknown; marks?: { partialPerCorrectOption?: unknown } }>) {
      const perOption = Number(section?.marks?.partialPerCorrectOption);
      if (typeof section?.id === "string" && Number.isFinite(perOption) && perOption > 0) {
        partialBySection.set(section.id, perOption);
      }
    }
  }
  return buildPolicyOverrides(test.questionMarking, partialBySection);
}

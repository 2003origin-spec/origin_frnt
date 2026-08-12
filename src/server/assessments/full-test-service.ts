/**
 * Full-length mock tests — student-side creation.
 *
 * Sits between the selection engine (`full-test-builder.ts`) and the existing
 * persisted-custom-test machinery, so a generated paper is an ORDINARY test
 * everywhere downstream: it lists in the Tests hub, opens in the same taker,
 * grades through the same submit path and shows in the same result view. The
 * only thing that makes it special is the blueprint and the per-question exam
 * marking travelling with it.
 *
 * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §5, D2, D5.
 */

import {
  blueprintTotalMarks,
  blueprintTotalQuestions,
  getExamBlueprint,
  summarizeAdaptations,
  type ExamBlueprint,
  type ExamPresetId,
} from "@/lib/exam-blueprints";
import type { Subject } from "@/lib/entitlements";
import { createId } from "@/server/store";
import {
  getAttemptedQuestionIdsForUser,
  persistGeneratedCustomTest,
} from "@/server/analytics-store";
import type { StudentScope } from "@/server/study-scope";

import { buildFullLengthTestSelection, type FullTestSelection } from "./full-test-builder";

/** Why a preset is not offered to this student, or `null` when it is. */
export type PresetLockReason = {
  kind: "missing_subjects";
  /** Subjects the preset needs that the student cannot currently reach. */
  missing: Subject[];
  message: string;
};

export type PresetAvailability = {
  preset: ExamPresetId;
  label: string;
  blurb: string;
  subjects: Subject[];
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  /** Section summary for the card's "what's inside" preview. */
  sections: Array<{ label: string; count: number; marking: string }>;
  locked: boolean;
  lockReason: PresetLockReason | null;
};

const SUBJECT_LABEL: Record<Subject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Mathematics",
  biology: "Biology",
};

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Subjects a preset needs that the student cannot draw from.
 *
 * D2: a preset is all-or-nothing. Generating a "JEE Main" mock out of two of its
 * three subjects would be a paper that is not the exam it claims to be, so the
 * card locks and says exactly which subject is missing instead.
 *
 * An unenforced scope (feature flag off, teacher, local dev) unlocks everything,
 * which is the same rule every other subject-gated surface follows.
 */
export function missingSubjectsForPreset(
  blueprint: ExamBlueprint,
  scope: Pick<StudentScope, "enforced" | "subjects">,
): Subject[] {
  if (!scope.enforced) return [];
  return blueprint.subjects.filter((subject) => !scope.subjects.includes(subject));
}

export function describePresetAvailability(
  scope: Pick<StudentScope, "enforced" | "subjects">,
  presets: readonly ExamPresetId[],
): PresetAvailability[] {
  return presets.map((preset) => {
    const blueprint = getExamBlueprint(preset);
    const missing = missingSubjectsForPreset(blueprint, scope);
    return {
      preset,
      label: blueprint.label,
      blurb: blueprint.blurb,
      subjects: [...blueprint.subjects],
      durationMinutes: blueprint.durationMinutes,
      totalQuestions: blueprintTotalQuestions(blueprint),
      totalMarks: blueprintTotalMarks(blueprint),
      sections: blueprint.sections.map((section) => ({
        label: section.label,
        count: section.count,
        marking: `+${section.marking.correct} / ${section.marking.incorrect === 0 ? "0" : `−${Math.abs(section.marking.incorrect)}`}`,
      })),
      locked: missing.length > 0,
      lockReason:
        missing.length === 0
          ? null
          : {
              kind: "missing_subjects",
              missing,
              message: `Unlock ${formatList(missing.map((s) => SUBJECT_LABEL[s]))} to build a ${blueprint.label} mock.`,
            },
    };
  });
}

/** Thrown when a student asks for a preset they are not entitled to (D2). */
export class PresetLockedError extends Error {
  status = 403;
  missing: Subject[];
  constructor(missing: Subject[], message: string) {
    super(message);
    this.name = "PresetLockedError";
    this.missing = missing;
  }
}

/** Thrown when the bank could not supply a usable paper at all. */
export class EmptyPaperError extends Error {
  status = 503;
  constructor() {
    super("The question bank could not supply a full-length paper right now. Please try again shortly.");
    this.name = "EmptyPaperError";
  }
}

function titleFor(blueprint: ExamBlueprint): string {
  return `${blueprint.label} Full Mock Test`;
}

function descriptionFor(selection: FullTestSelection, blueprint: ExamBlueprint): string {
  const base = `${selection.totalQuestions} questions · ${selection.totalMarks} marks · ${blueprint.durationMinutes} minutes. Sectional paper with ${blueprint.label} marking.`;
  const adapted = summarizeAdaptations(selection.adaptations);
  return adapted ? `${base} ${adapted}` : base;
}

/**
 * The blueprint snapshot persisted alongside the paper. Recorded at generation
 * time so a mock taken today still explains itself after the blueprint constants
 * change — the taker reads sections and marking from HERE, never from the live
 * blueprint.
 */
function blueprintSnapshot(selection: FullTestSelection): Record<string, unknown> {
  return {
    version: 1,
    preset: selection.preset,
    label: selection.blueprintLabel,
    durationMinutes: selection.durationMinutes,
    totalQuestions: selection.totalQuestions,
    totalMarks: selection.totalMarks,
    seed: selection.seed,
    sections: selection.sections,
    adaptations: selection.adaptations,
    adaptationSummary: summarizeAdaptations(selection.adaptations),
    generatedAt: new Date().toISOString(),
  };
}

export type CreateFullLengthTestInput = {
  userId: string;
  preset: ExamPresetId;
  scope: Pick<StudentScope, "enforced" | "subjects">;
};

/**
 * Builds and persists a full-length mock for a student, returning the persisted
 * test id. The caller re-reads it through the normal persisted-custom-test path
 * so the response is byte-identical in shape to any other test.
 */
export async function createFullLengthTest(input: CreateFullLengthTestInput): Promise<{
  testId: string;
  selection: FullTestSelection;
}> {
  const blueprint = getExamBlueprint(input.preset);

  const missing = missingSubjectsForPreset(blueprint, input.scope);
  if (missing.length > 0) {
    throw new PresetLockedError(
      missing,
      `Unlock ${formatList(missing.map((s) => SUBJECT_LABEL[s]))} to build a ${blueprint.label} mock.`,
    );
  }

  // Freshness is best-effort: questions the student has already attempted are
  // avoided where the bank can afford it and silently dropped where it cannot
  // (see `softExcludeIds`). A read failure must not block generation.
  const attempted = await getAttemptedQuestionIdsForUser(input.userId).catch(() => [] as string[]);

  const testId = createId("test");
  const selection = await buildFullLengthTestSelection({
    preset: input.preset,
    // Includes the new test id, so every generation is a different paper even
    // for the same student and preset within the same millisecond.
    seed: `${input.userId}:${input.preset}:${testId}`,
    softExcludeIds: attempted,
  });

  if (selection.totalQuestions === 0) {
    throw new EmptyPaperError();
  }

  const questionMarking = new Map(
    selection.questions.map((question) => [
      question.questionId,
      {
        sectionId: question.sectionId,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
      },
    ]),
  );

  await persistGeneratedCustomTest({
    id: testId,
    userId: input.userId,
    // A full-length paper spans subjects by definition; "mixed" is the existing
    // vocabulary for that and keeps every subject-facing filter working.
    subject: "mixed",
    chapter: null,
    difficulty: input.preset === "jee-advanced" ? "hard" : "medium",
    title: titleFor(blueprint),
    description: descriptionFor(selection, blueprint),
    questionIds: selection.questions.map((question) => question.questionId),
    durationMinutes: selection.durationMinutes,
    focusTopics: [],
    generationSummary: `Generated from the ${blueprint.label} blueprint across ${selection.sections.length} sections.`,
    // Real papers budget by the whole duration, not per question; this keeps the
    // taker's per-question pacing hint proportional to the actual paper.
    recommendedTimePerQuestionSeconds: Math.max(
      30,
      Math.round((selection.durationMinutes * 60) / Math.max(1, selection.totalQuestions)),
    ),
    examPreset: input.preset,
    blueprint: blueprintSnapshot(selection),
    questionMarking,
  });

  return { testId, selection };
}

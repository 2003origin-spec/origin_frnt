/**
 * Full-length mock generation for teachers.
 *
 * Runs the SAME blueprint + selection engine the student presets use, then lands
 * the result in the existing teacher-test tables so everything downstream —
 * publish, schedule, assign to batches, cohort analytics, share-as-DPP — works
 * with no special-casing. The only teacher-specific parts are where the paper
 * goes (`assessment.tests`) and who may create it (workspace membership).
 *
 * Differences from the student path, both deliberate:
 *  - no Study Mode / entitlement clamp — a teacher builds papers for students,
 *    not from their own subscription;
 *  - the paper starts as a `draft`, so the teacher reviews and publishes it
 *    rather than it going live the moment it is generated.
 *
 * Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §5, Phase 6.
 */

import { AuthzError } from "@/server/authz";
import {
  getExamBlueprint,
  isExamPresetId,
  summarizeAdaptations,
  type ExamPresetId,
} from "@/lib/exam-blueprints";
import { buildFullLengthTestSelection } from "@/server/assessments/full-test-builder";

import { createTeacherTest, type TestQuestionInput } from "./tests-service";
import type { TestWithQuestions } from "./types";

export type GenerateFullLengthTestInput = {
  workspaceId: string;
  actorUserId: string;
  preset: ExamPresetId;
  /** Optional override; defaults to "<Exam> Full Mock Test". */
  title?: string | null;
  requestId?: string | null;
};

export async function generateFullLengthTeacherTest(
  input: GenerateFullLengthTestInput,
): Promise<{ test: TestWithQuestions; adaptationSummary: string | null }> {
  if (!isExamPresetId(input.preset)) {
    throw new AuthzError(400, "Unknown exam preset.");
  }
  const blueprint = getExamBlueprint(input.preset);

  const selection = await buildFullLengthTestSelection({
    preset: input.preset,
    // Scoped to the workspace so two teachers generating the same preset on the
    // same day do not hand out identical papers.
    seed: `${input.workspaceId}:${input.actorUserId}:${input.preset}:${Date.now()}`,
  });

  if (selection.totalQuestions === 0) {
    throw new AuthzError(503, "The question bank could not supply a full-length paper right now.");
  }

  const adaptationSummary = summarizeAdaptations(selection.adaptations);
  const questions: TestQuestionInput[] = selection.questions.map((question, index) => ({
    // assessment.test_questions positions are 1-based (the route's schema
    // enforces min(1)); the builder's are 0-based paper offsets.
    position: index + 1,
    sourceBank: "ogcode",
    ogcodeQuestionId: question.questionId,
    marks: question.marks,
    negativeMarks: question.negativeMarks,
    // The section is what makes this a sectional paper rather than a flat list;
    // the student taker reads it back to render section tabs.
    metadata: {
      sectionId: question.sectionId,
      examPreset: input.preset,
      difficulty: question.difficulty,
      questionType: question.questionType,
    },
  }));

  const description = [
    `${selection.totalQuestions} questions · ${selection.totalMarks} marks · ${blueprint.durationMinutes} minutes.`,
    `Sectional paper generated on the ${blueprint.label} pattern with that exam's marking.`,
    adaptationSummary,
  ]
    .filter(Boolean)
    .join(" ");

  const test = await createTeacherTest({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    createdBy: input.actorUserId,
    title: (input.title?.trim() || `${blueprint.label} Full Mock Test`).slice(0, 200),
    description,
    // A full-length paper spans subjects by definition.
    subject: "mixed",
    chapter: null,
    difficulty: input.preset === "jee-advanced" ? "hard" : "medium",
    durationMinutes: blueprint.durationMinutes,
    // Generated, not hand-picked — the enum already has a value for this.
    source: "analytics_generated",
    // Draft: the teacher reviews before students can see it.
    status: "draft",
    // The blueprint snapshot lives on the test, exactly as it does for a student
    // mock, so a paper explains itself long after the constants change.
    selectionPolicy: {
      kind: "full_length_mock",
      version: 1,
      preset: selection.preset,
      label: selection.blueprintLabel,
      seed: selection.seed,
      totalQuestions: selection.totalQuestions,
      totalMarks: selection.totalMarks,
      sections: selection.sections,
      adaptations: selection.adaptations,
      adaptationSummary,
      generatedAt: new Date().toISOString(),
    },
    // Per-question marks on test_questions are the authority at grade time; this
    // records the paper-level scheme for the teacher's own reference.
    scoringPolicy: {
      kind: "exam_blueprint",
      preset: selection.preset,
      sections: selection.sections.map((section) => ({ id: section.id, marks: section.marks })),
    },
    questions,
    requestId: input.requestId,
  });

  return { test, adaptationSummary };
}

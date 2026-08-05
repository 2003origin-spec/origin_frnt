/**
 * Mixed-source test-question resolution (Phase 15).
 *
 * A teacher test (`assessment.test_questions`) can mix question sources:
 *   • `ogcode`        → resolved from the ogcode catalog (OGCODE pool)
 *   • `workspace_bag` → resolved from the Question Bag (`content.questions`, USER pool)
 *
 * The legacy taker/grader works on `StoredQuestion`. This module maps a
 * Question-Bag `QuestionWithVersion` into that shape so the SAME render/grade
 * machinery handles both banks. ogcode rows are resolved by the existing
 * `getOgcodeCatalogQuestionMap`; this module fills the workspace_bag gap that the
 * ogcode-only take path used to drop silently.
 */

import type { StoredQuestion } from "@/legacy/store";

import { getQuestionWithVersion } from "./questions";
import type { QuestionWithVersion } from "./types";

const VALID_DIFFICULTIES = new Set(["easy", "medium", "hard", "insane"]);

/** Map a Question-Bag question (current version) into the legacy StoredQuestion shape. */
export function mapContentQuestionToStored(qwv: QuestionWithVersion): StoredQuestion | null {
  const v = qwv.currentVersion;
  if (!v) return null;
  const answerSpec = (v.answerSpec as StoredQuestion["answerSpec"]) ?? null;
  return {
    id: qwv.id,
    text: v.stem,
    // content options are { id, text, image? } objects; the legacy renderer wants
    // string[] for text + a parallel image array.
    options: v.options ? v.options.map((o) => o.text) : null,
    optionImages: v.options ? v.options.map((o) => o.image ?? null) : null,
    correctOption: v.correctOption,
    correctOptions: v.correctOptions,
    answerText: v.answerText,
    tolerance: (answerSpec?.tolerance as number | null | undefined) ?? null,
    matrixData: (v.matrixData as StoredQuestion["matrixData"]) ?? null,
    explanation: v.explanation ?? "",
    hint: v.hint,
    answerSpec,
    // Question-Bag authoring doesn't enforce these as non-empty (the DB column
    // types are "string" at the TS layer via an `as string` cast, not a runtime
    // guarantee), and analytics-service's GradedAttempt requires all four as
    // non-nullable strings — a blank one would either fail Pydantic validation
    // outright for the WHOLE test's analysis, or feed an empty-string "topic"
    // into weak-topic detection. Default rather than let either happen.
    subject: (v.subject?.trim() || "general"),
    chapter: (v.chapter?.trim() || "Uncategorized"),
    concept: (v.concept?.trim() || v.chapter?.trim() || "General"),
    difficulty: VALID_DIFFICULTIES.has(String(v.difficulty)) ? (v.difficulty as StoredQuestion["difficulty"]) : "medium",
    image: v.imageUrl ?? null,
    tags: v.tags ?? null,
    questionType: v.questionType as StoredQuestion["questionType"],
    acceptanceRate: 0,
    totalCorrect: 0,
    frequency: 0,
    isChallengeOfTheDay: false,
  };
}

/**
 * Resolve Question-Bag question ids (the `content.questions.id`s used as a test's
 * question ids) into StoredQuestions. Best-effort per id — a missing/unversioned
 * question is simply omitted (the caller's resolution-metadata check surfaces gaps).
 */
export async function getContentQuestionStoredMap(
  ids: string[],
): Promise<Map<string, StoredQuestion>> {
  const map = new Map<string, StoredQuestion>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return map;
  const resolved = await Promise.all(
    unique.map((id) => getQuestionWithVersion(id).catch(() => null)),
  );
  for (const qwv of resolved) {
    if (!qwv) continue;
    const stored = mapContentQuestionToStored(qwv);
    if (stored) map.set(qwv.id, stored);
  }
  return map;
}

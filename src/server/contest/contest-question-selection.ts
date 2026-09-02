/**
 * Contest question resolution + pool-shortfall detection (plan Phase 0
 * validation gate). Turns an admin's per-subject/topic selection into the
 * concrete, frozen question set to publish — resolving real questions from the
 * OGCode bank and REJECTING (with the offending subject named) when the pool
 * can't fill the requested counts. Because the published paper is immutable, a
 * short/empty paper must be caught here, before freeze.
 *
 * Selection is deterministic per contest (seeded by contestId) so a preview and
 * the eventual publish resolve to the same paper. Per D4, the live paper is one
 * fixed pinned set (shared by all takers); the per-USER shuffle happens later at
 * delivery, not here.
 */

import {
  getOgcodeCatalogQuestionMap,
  sampleOgcodeCatalogQuestionIds,
} from "@/server/ogcode-catalog";
import type { ContestQuestionInput } from "./contest-admin-service";

function selectionError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** One subject's slice of the paper: how many questions, optionally scoped to
 *  chapters/topics and a difficulty band. */
export interface SubjectSelection {
  subject: string;
  count: number;
  /** OGCode chapters to draw from (empty/omitted = the whole subject). */
  topics?: string[];
  difficulties?: string[];
  /**
   * Question types to draw from. Omitted/empty = `["mcq"]` — the historical,
   * MCQ-only behaviour (unchanged). Additional types (msq/numerical/…) are only
   * passed when the CONTEST_QUESTION_TYPES surface builds a multi-type paper.
   */
  types?: string[];
}

/** The only type contests have ever drawn; the default when none is specified. */
const DEFAULT_CONTEST_TYPES = ["mcq"] as const;

export interface ResolveOptions {
  contestId: string;
  selections: SubjectSelection[];
}

/** Build the immutable snapshot frozen into contest.contest_questions: enough
 *  to render AND grade the question independent of later OGCode edits. */
function freezeSnapshot(q: {
  text: string;
  options: string[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  tolerance: number | null;
  answerSpec?: unknown;
  matrixData?: unknown;
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
  image?: string | null;
  optionImages?: (string | null)[] | null;
}): Record<string, unknown> {
  return {
    text: q.text,
    options: q.options,
    image: q.image ?? null,
    optionImages: q.optionImages ?? null,
    correctOption: q.correctOption,
    correctOptions: q.correctOptions,
    answerText: q.answerText,
    tolerance: q.tolerance,
    // Carried so non-MCQ types (numerical-with-units / symbolic / matrix-match)
    // freeze a self-contained gradeable snapshot. Null for plain MCQ — no change
    // to existing MCQ papers.
    answerSpec: q.answerSpec ?? null,
    matrixData: q.matrixData ?? null,
    explanation: q.explanation,
    subject: q.subject,
    chapter: q.chapter,
    difficulty: q.difficulty,
    questionType: q.questionType,
  };
}

/**
 * Resolve an admin selection into the ordered, frozen question set to publish.
 * Throws 400 (naming the subject) if any subject's pool is short. Positions are
 * assigned sequentially across subjects in selection order.
 */
export async function resolveContestQuestions(
  opts: ResolveOptions,
): Promise<ContestQuestionInput[]> {
  const { contestId, selections } = opts;
  if (!selections.length) {
    throw selectionError(400, "Select at least one subject to build the paper.");
  }

  // 1. Sample ids per subject (seeded by contest + subject for determinism) and
  //    detect shortfall before touching the full-data fetch.
  const perSubjectIds: { selection: SubjectSelection; ids: string[] }[] = [];
  for (const sel of selections) {
    const count = Math.trunc(sel.count);
    if (!(count > 0)) {
      throw selectionError(400, `Question count for ${sel.subject} must be greater than 0.`);
    }
    // Types to draw from. Default MCQ (historical). When several are chosen, split
    // the requested count across them (remainder to the earliest types) so the
    // multiselect is honest — the pool for each type is filtered to that type, so
    // a question a renderer can't display never enters the paper.
    const types = sel.types && sel.types.length ? sel.types : [...DEFAULT_CONTEST_TYPES];
    const base = Math.floor(count / types.length);
    const remainder = count % types.length;
    const ids: string[] = [];
    for (let ti = 0; ti < types.length; ti++) {
      const typeCount = base + (ti < remainder ? 1 : 0);
      if (typeCount <= 0) continue;
      const rows = await sampleOgcodeCatalogQuestionIds({
        subject: sel.subject,
        chapters: sel.topics && sel.topics.length ? sel.topics : null,
        difficulties: sel.difficulties && sel.difficulties.length ? sel.difficulties : null,
        type: types[ti],
        includeContestImports: true,
        seed: `${contestId}:${sel.subject}:${types[ti]}`,
        limit: typeCount,
      });
      if (rows.length < typeCount) {
        const scope = sel.topics && sel.topics.length ? ` (topics: ${sel.topics.join(", ")})` : "";
        const typeLabel = types.length > 1 ? ` ${types[ti].toUpperCase()}` : "";
        throw selectionError(
          400,
          `Not enough ${sel.subject}${typeLabel} questions${scope}: need ${typeCount}, the bank has ${rows.length}. Widen the topics/types or lower the count before publishing.`,
        );
      }
      ids.push(...rows.map((r) => r.id));
    }
    perSubjectIds.push({ selection: sel, ids });
  }

  // 2. Fetch full data for every chosen id in one map lookup, then freeze.
  const allIds = perSubjectIds.flatMap((p) => p.ids);
  const dataMap = await getOgcodeCatalogQuestionMap(allIds);

  const questions: ContestQuestionInput[] = [];
  for (const { selection, ids } of perSubjectIds) {
    for (const id of ids) {
      const q = dataMap.get(id);
      if (!q) {
        // A sampled id vanished between sample and fetch (concurrent edit) —
        // fail closed rather than freeze a hole.
        throw selectionError(409, `Question ${id} is no longer available; rebuild the paper.`);
      }
      questions.push({
        questionId: q.id,
        subject: selection.subject,
        sectionId: selection.subject,
        snapshot: freezeSnapshot(q),
        marks: null,
        negativeMarks: null,
      });
    }
  }
  return questions;
}

/**
 * Resolve ONE fresh replacement question for a subject/topic, excluding the ids
 * already in the (preview) paper so the swap is never a duplicate. Used by the
 * admin builder's per-question "replace" action. Throws (400) when the scoped
 * pool is exhausted. MCQ-only, same as the paper.
 */
export async function resolveOneReplacement(input: {
  contestId: string;
  subject: string;
  topics?: string[];
  difficulties?: string[];
  excludeIds: string[];
}): Promise<ContestQuestionInput> {
  const rows = await sampleOgcodeCatalogQuestionIds({
    subject: input.subject,
    chapters: input.topics && input.topics.length ? input.topics : null,
    difficulties: input.difficulties && input.difficulties.length ? input.difficulties : null,
    type: "mcq",
    includeContestImports: true,
    excludeIds: input.excludeIds,
    seed: `${input.contestId}:${input.subject}:replace`,
    limit: 1,
  });
  if (rows.length === 0) {
    throw selectionError(400, `No more ${input.subject} questions available to swap in.`);
  }
  const dataMap = await getOgcodeCatalogQuestionMap([rows[0].id]);
  const q = dataMap.get(rows[0].id);
  if (!q) throw selectionError(409, "Question is no longer available; try again.");
  return {
    questionId: q.id,
    subject: input.subject,
    sectionId: input.subject,
    snapshot: freezeSnapshot(q),
    marks: null,
    negativeMarks: null,
  };
}

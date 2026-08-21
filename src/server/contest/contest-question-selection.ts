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
}

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
  explanation: string;
  subject: string;
  chapter: string;
  difficulty: string;
  questionType: string;
}): Record<string, unknown> {
  return {
    text: q.text,
    options: q.options,
    correctOption: q.correctOption,
    correctOptions: q.correctOptions,
    answerText: q.answerText,
    tolerance: q.tolerance,
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
    const rows = await sampleOgcodeCatalogQuestionIds({
      subject: sel.subject,
      chapters: sel.topics && sel.topics.length ? sel.topics : null,
      difficulties: sel.difficulties && sel.difficulties.length ? sel.difficulties : null,
      seed: `${contestId}:${sel.subject}`,
      limit: count,
    });
    if (rows.length < count) {
      const scope = sel.topics && sel.topics.length ? ` (topics: ${sel.topics.join(", ")})` : "";
      throw selectionError(
        400,
        `Not enough ${sel.subject} questions${scope}: need ${count}, the bank has ${rows.length}. Widen the topics or lower the count before publishing.`,
      );
    }
    perSubjectIds.push({ selection: sel, ids: rows.map((r) => r.id) });
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

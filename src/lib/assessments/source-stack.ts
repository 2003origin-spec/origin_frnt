/**
 * Stacking several question sources into one paper — pure logic, shared by the
 * CBT builder and the Origin teacher builder.
 *
 * A teacher building a mock usually has the material spread across a few
 * places: an imported document, a topic group in their bank, last term's paper.
 * Selection order IS paper order — source 1's questions first, then source 2's,
 * each source keeping its own internal order.
 *
 * De-duplication is first-occurrence-wins. Two chosen sources routinely
 * overlap, and the same question twice in one paper would be asked of the
 * student twice — so a repeat keeps its earliest position, and its marks come
 * from the source that placed it there.
 *
 * The `kind` is a type parameter rather than a fixed union: CBT stacks
 * documents and clusters, the teacher side stacks documents, topic groups and
 * existing tests, and neither needs to know about the other's vocabulary.
 */

export type TestSource<K extends string = string> = {
  kind: K;
  id: string;
  /** Marks for every question contributed by this source. */
  marks?: number;
  negativeMarks?: number;
};

/** A source plus the question ids it resolved to, in the source's own order. */
export type ResolvedTestSource<K extends string = string> = TestSource<K> & { questionIds: string[] };

export type StackedQuestion = {
  questionId: string;
  marks: number;
  negativeMarks: number;
  /** Which source placed it — used for the per-source summary. */
  sourceId: string;
};

export type SourceStackResult<K extends string = string> = {
  questions: StackedQuestion[];
  perSource: { kind: K; id: string; added: number; duplicates: number }[];
};

export const DEFAULT_SOURCE_MARKS = 4;
export const DEFAULT_SOURCE_NEGATIVE_MARKS = -1;

function normalizeMarks(value: unknown): number {
  const n = Number(value);
  // A zero-mark question is never intentional, matching setTestQuestions.
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SOURCE_MARKS;
}

/**
 * Canonical sign for negative marks: **stored values are always ≤ 0**.
 *
 * Two UIs disagree about what the teacher types. The wizard's "Negative Marks (−)"
 * field is a magnitude (`min={0}`, default `1`) and the test-edit page converts
 * storage back with `Math.abs`, while `CreateTestDialog`, the source stack and the
 * document importer all send `-1`. Nothing on the write path ever reconciled them,
 * so `assessment.test_questions.negative_marks` holds both signs — and a positive
 * one made `policyFromQuestionMarks` read "no negative marking, worth +1", which
 * *awarded* a mark for every wrong answer in a shared DPP.
 *
 * `1` and `-1` therefore both mean "deduct one mark". `0` is preserved exactly:
 * "no negative marking" is a real choice a teacher makes, and their number wins
 * (TEACHER_DPP_SCORING_AND_ANALYTICS_PLAN.md D2).
 *
 * Plan: V1/allmd/TEACHER_DPP_DELIVERY_AND_LIVE_SCORING_PLAN.md (D2)
 */
export function canonicalNegativeMarks(value: unknown): number {
  // `Number(null)` and `Number("")` are both 0, so a missing value would read as
  // the deliberate "no negative marking" choice. Absence is not a choice.
  if (value === null || value === undefined || value === "") {
    return DEFAULT_SOURCE_NEGATIVE_MARKS;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SOURCE_NEGATIVE_MARKS;
  return n === 0 ? 0 : -Math.abs(n);
}


export function stackSources<K extends string>(sources: ResolvedTestSource<K>[]): SourceStackResult<K> {
  const seen = new Set<string>();
  const questions: StackedQuestion[] = [];
  const perSource: SourceStackResult<K>["perSource"] = [];

  for (const source of sources) {
    const marks = normalizeMarks(source.marks);
    const negativeMarks = canonicalNegativeMarks(source.negativeMarks);
    let added = 0;
    let duplicates = 0;

    for (const questionId of source.questionIds) {
      if (!questionId) continue;
      if (seen.has(questionId)) {
        duplicates += 1;
        continue;
      }
      seen.add(questionId);
      questions.push({ questionId, marks, negativeMarks, sourceId: source.id });
      added += 1;
    }

    perSource.push({ kind: source.kind, id: source.id, added, duplicates });
  }

  return { questions, perSource };
}

/**
 * Parses and validates an API `sources` array against the caller's vocabulary.
 * Entries with an unknown kind or a blank id are dropped rather than throwing:
 * a source the workspace can't resolve must not fail the whole build.
 */
export function parseSources<K extends string>(raw: unknown, allowedKinds: readonly K[]): TestSource<K>[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(allowedKinds);
  const sources: TestSource<K>[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { kind, id, marks, negativeMarks } = entry as Record<string, unknown>;
    if (typeof kind !== "string" || !allowed.has(kind)) continue;
    if (typeof id !== "string" || !id.trim()) continue;
    sources.push({
      kind: kind as K,
      id: id.trim(),
      marks: marks === undefined ? undefined : Number(marks),
      negativeMarks: negativeMarks === undefined ? undefined : Number(negativeMarks),
    });
  }
  return sources;
}

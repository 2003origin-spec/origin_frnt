/**
 * Stacking several question sources into one paper — pure logic.
 *
 * A teacher building a mock usually has the material spread across a few
 * documents and clusters ("physics paper", the thermodynamics cluster, last
 * year's chemistry set). Selection order is the paper order: source 1's
 * questions first, then source 2's, and so on, each source keeping its own
 * internal order.
 *
 * De-duplication is first-occurrence-wins. Two chosen clusters routinely
 * overlap, and the same question twice in one paper would be asked of the
 * student twice — so a repeat keeps its earliest position and its marks come
 * from the source that placed it there.
 */

export type CbtTestSourceKind = "import_job" | "cluster";

export type CbtTestSource = {
  kind: CbtTestSourceKind;
  id: string;
  /** Marks for every question contributed by this source. */
  marks?: number;
  negativeMarks?: number;
};

/** A source plus the question ids it resolved to, in the source's own order. */
export type ResolvedSource = CbtTestSource & { questionIds: string[] };

export type StackedQuestion = {
  questionId: string;
  marks: number;
  negativeMarks: number;
  /** Which source placed it — used for the per-source summary. */
  sourceId: string;
};

export type StackResult = {
  questions: StackedQuestion[];
  perSource: { kind: CbtTestSourceKind; id: string; added: number; duplicates: number }[];
};

export const DEFAULT_SOURCE_MARKS = 4;
export const DEFAULT_SOURCE_NEGATIVE_MARKS = -1;

function normalizeMarks(value: unknown): number {
  const n = Number(value);
  // A zero-mark question is never intentional, matching setTestQuestions.
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SOURCE_MARKS;
}

function normalizeNegativeMarks(value: unknown): number {
  const n = Number(value);
  // 0 is a valid choice here ("no negative marking"), so only a non-number falls back.
  return Number.isFinite(n) ? n : DEFAULT_SOURCE_NEGATIVE_MARKS;
}

export function stackSources(sources: ResolvedSource[]): StackResult {
  const seen = new Set<string>();
  const questions: StackedQuestion[] = [];
  const perSource: StackResult["perSource"] = [];

  for (const source of sources) {
    const marks = normalizeMarks(source.marks);
    const negativeMarks = normalizeNegativeMarks(source.negativeMarks);
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

/** Parses and validates the API's `sources` array. Throws on a malformed entry. */
export function parseTestSources(raw: unknown): CbtTestSource[] {
  if (!Array.isArray(raw)) return [];
  const sources: CbtTestSource[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { kind, id, marks, negativeMarks } = entry as Record<string, unknown>;
    if (kind !== "import_job" && kind !== "cluster") continue;
    if (typeof id !== "string" || !id.trim()) continue;
    sources.push({
      kind,
      id: id.trim(),
      marks: marks === undefined ? undefined : Number(marks),
      negativeMarks: negativeMarks === undefined ? undefined : Number(negativeMarks),
    });
  }
  return sources;
}

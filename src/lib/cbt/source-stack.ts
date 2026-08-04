/**
 * CBT's vocabulary for the shared source stacker.
 *
 * The stacking logic itself (paper order, first-occurrence-wins de-dup,
 * per-source marks) lives in `@/lib/assessments/source-stack` because the
 * Origin teacher builder stacks sources the same way — it just picks from
 * documents, topic groups and existing tests instead of documents and clusters.
 * This module keeps CBT's kinds and its existing public API unchanged.
 */

import {
  parseSources,
  stackSources,
  type ResolvedTestSource,
  type SourceStackResult,
  type TestSource,
} from "@/lib/assessments/source-stack";

export {
  stackSources,
  DEFAULT_SOURCE_MARKS,
  DEFAULT_SOURCE_NEGATIVE_MARKS,
  type StackedQuestion,
} from "@/lib/assessments/source-stack";

export type CbtTestSourceKind = "import_job" | "cluster";

export const CBT_TEST_SOURCE_KINDS: readonly CbtTestSourceKind[] = ["import_job", "cluster"];

export type CbtTestSource = TestSource<CbtTestSourceKind>;
export type ResolvedSource = ResolvedTestSource<CbtTestSourceKind>;
export type StackResult = SourceStackResult<CbtTestSourceKind>;

/** Parses and validates the CBT API's `sources` array. */
export function parseTestSources(raw: unknown): CbtTestSource[] {
  return parseSources(raw, CBT_TEST_SOURCE_KINDS);
}

/** Re-exported so callers can stack CBT sources without the generic parameter. */
export function stackCbtSources(sources: ResolvedSource[]): StackResult {
  return stackSources(sources);
}

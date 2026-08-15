/**
 * Subject-wise question load — pure, client-safe model for the Custom Test
 * Builder (Build tab, room auto-build).
 *
 * The builder now asks for a per-subject question count instead of one total.
 * This module is the ONE place that turns a base number + "same for all"
 * checkbox into the concrete `{ subject → count }` map, computes the total, and
 * derives the test duration from the configurable per-question timer.
 *
 * Nothing here touches the database, `next/*`, or any browser API, so it is safe
 * to import from client components, RSC, route handlers and `node:test` alike —
 * the same split `src/lib/study-mode.ts` uses. Both the UI (live preview) and the
 * server (authoritative recompute) call these helpers, so they can never disagree
 * on how a base number expands into per-subject counts.
 *
 * NEET rule: on NEET the real paper is 45/45/90 (Physics/Chemistry/Biology), so
 * an equal base `N` gives Biology `2N` and the others `N`. JEE/PCMB keep every
 * subject at `N`.
 *
 * Plan: V1/SUBJECTWISE_TEST_BUILDER_PLAN.md
 */

import { normalizeSubject, type Subject } from "@/lib/entitlements";
import type { StudyMode } from "@/lib/study-mode";

/** Per-subject question count bounds. Counts are open well past the old 1–50. */
export const MIN_QUESTIONS_PER_SUBJECT = 1;
export const MAX_QUESTIONS_PER_SUBJECT = 500;

/** Per-question timer bounds (seconds). Default 2 min, configurable up to 5 min. */
export const MIN_SECONDS_PER_QUESTION = 30;
export const MAX_SECONDS_PER_QUESTION = 300;
export const DEFAULT_SECONDS_PER_QUESTION = 120;

/** The multiplier Biology gets over the base count when the mode is NEET. */
export const NEET_BIOLOGY_MULTIPLIER = 2;

export type SubjectCounts = Partial<Record<Subject, number>>;

/** Clamp a per-question timer to [30, 300], defaulting when absent/invalid. */
export function clampSecondsPerQuestion(value: number | null | undefined): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SECONDS_PER_QUESTION;
  return Math.max(MIN_SECONDS_PER_QUESTION, Math.min(MAX_SECONDS_PER_QUESTION, n));
}

/** Coerce one raw count to an integer in [1, 500], or null if it is not usable. */
function coerceCount(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < MIN_QUESTIONS_PER_SUBJECT) return null;
  return Math.min(MAX_QUESTIONS_PER_SUBJECT, n);
}

/**
 * Normalise a loose `{ subject → count }` record into canonical subjects with
 * integer counts in [1, 500]. Unknown subjects and non-positive counts are
 * dropped, so the result is always safe to persist / query.
 */
export function clampSubjectCounts(raw: Record<string, unknown> | null | undefined): SubjectCounts {
  const out: SubjectCounts = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    const subject = normalizeSubject(key);
    if (!subject) continue;
    const count = coerceCount(value);
    if (count == null) continue;
    // If the same canonical subject appears twice (e.g. "maths"/"mathematics"),
    // keep the larger request rather than letting order decide.
    out[subject] = Math.max(out[subject] ?? 0, count);
  }
  return out;
}

/** True when Biology should be doubled for this mode (NEET paper shape). */
export function biologyIsDoubled(mode: StudyMode): boolean {
  return mode === "neet";
}

/**
 * Expand a single base count `N` across the given subjects — the "same questions
 * in all subjects" path. Biology becomes `2N` on NEET; every other subject is
 * `N`. Subjects are normalised and de-duplicated; the base is clamped to
 * [1, 500] and Biology's doubled value is capped at 500 too.
 */
export function resolveEqualCounts(
  subjects: readonly string[],
  baseCount: number,
  mode: StudyMode,
): SubjectCounts {
  const base = coerceCount(baseCount);
  const out: SubjectCounts = {};
  if (base == null) return out;
  const doubleBio = biologyIsDoubled(mode);
  for (const raw of subjects) {
    const subject = normalizeSubject(raw);
    if (!subject) continue;
    const count = subject === "biology" && doubleBio ? base * NEET_BIOLOGY_MULTIPLIER : base;
    out[subject] = Math.min(MAX_QUESTIONS_PER_SUBJECT, count);
  }
  return out;
}

/** Sum of all per-subject counts. */
export function totalQuestions(counts: SubjectCounts): number {
  return Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

/**
 * Test duration in whole minutes: `ceil(totalQuestions × secondsPerQuestion / 60)`.
 * `secondsPerQuestion` is clamped first, so callers can pass a raw value.
 * Returns 0 when there are no questions.
 */
export function computeDurationMinutes(
  counts: SubjectCounts,
  secondsPerQuestion: number | null | undefined,
): number {
  const total = totalQuestions(counts);
  if (total <= 0) return 0;
  const spq = clampSecondsPerQuestion(secondsPerQuestion);
  return Math.ceil((total * spq) / 60);
}

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

// ─── Exam presets ────────────────────────────────────────────────────────────

export type BuilderExam = "jee" | "neet";
export const BUILDER_EXAMS: BuilderExam[] = ["jee", "neet"];

/** Subjects each exam draws from. JEE = PCM, NEET = PCB. */
export const EXAM_SUBJECTS: Readonly<Record<BuilderExam, readonly Subject[]>> = Object.freeze({
  jee: Object.freeze<Subject[]>(["physics", "chemistry", "mathematics"]),
  neet: Object.freeze<Subject[]>(["physics", "chemistry", "biology"]),
});

export const EXAM_LABELS: Record<BuilderExam, string> = { jee: "JEE", neet: "NEET" };

/** The study mode an exam maps to — drives the double-Biology rule on NEET. */
export function examMode(exam: BuilderExam): StudyMode {
  return exam;
}

/**
 * An exam chip is unlocked only when the student owns ALL of that exam's
 * subjects (JEE → P∧C∧M, NEET → P∧C∧B). `owned` is the entitled-subject set.
 */
export function examUnlocked(exam: BuilderExam, owned: ReadonlySet<string> | readonly string[]): boolean {
  const set = owned instanceof Set ? owned : new Set(owned);
  return EXAM_SUBJECTS[exam].every((s) => set.has(s));
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Marks awarded for a correct answer. Every JEE/NEET question type (MCQ, MSQ,
 * numerical) awards +4 for a correct answer — only the negative differs — so the
 * MAX attainable score is `4 × totalQuestions` regardless of the type mix.
 */
export const MARKS_PER_QUESTION = 4;

/** Maximum attainable score for the configured load (marks-per-question × total). */
export function computeMaxScore(counts: SubjectCounts): number {
  return totalQuestions(counts) * MARKS_PER_QUESTION;
}

// ─── Total-exam-time (hh:mm:ss) ────────────────────────────────────────────────

export type Hms = { h: number; m: number; s: number };
/** Total-exam-time bounds: 1 minute … 6 hours. */
export const MIN_TOTAL_MINUTES = 1;
export const MAX_TOTAL_MINUTES = 6 * 60;

export function clampHms(hms: Hms): Hms {
  const h = Math.max(0, Math.min(6, Math.trunc(Number(hms.h) || 0)));
  const m = Math.max(0, Math.min(59, Math.trunc(Number(hms.m) || 0)));
  const s = Math.max(0, Math.min(59, Math.trunc(Number(hms.s) || 0)));
  return { h, m, s };
}

/** Whole minutes for an hh:mm:ss value, ceil (so 45s → 1 min), clamped to bounds. */
export function hmsToMinutes({ h, m, s }: Hms): number {
  const totalSeconds = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  const minutes = Math.ceil(totalSeconds / 60);
  return Math.max(MIN_TOTAL_MINUTES, Math.min(MAX_TOTAL_MINUTES, minutes));
}

/** Split whole seconds into an hh:mm:ss triple (for seeding the total-time field). */
export function secondsToHms(totalSeconds: number): Hms {
  const t = Math.max(0, Math.trunc(Number(totalSeconds) || 0));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** Zero-padded "hh:mm:ss" for display. */
export function formatHms({ h, m, s }: Hms): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
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

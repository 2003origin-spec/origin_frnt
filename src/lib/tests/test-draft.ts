/**
 * On-device draft for a mock / study-room test attempt.
 *
 * The attempt used to live only in React state, so an Android Back gesture, a
 * browser Back, a refresh, or a WebView renderer crash threw away every
 * answer. The draft is mirrored here on every change and restored when the
 * same user opens the same paper again; it is cleared after a successful
 * submit. The malpractice strike count travels with it.
 *
 * Everything is best-effort and pure apart from the injected storage: blocked
 * or full storage must never break the exam.
 */

import type { UserAnswer } from "@/types";

export const TEST_DRAFT_VERSION = 1;
/** Keep a draft this long after the paper's own time has run out. */
export const TEST_DRAFT_GRACE_MS = 6 * 60 * 60 * 1000;

export type TestDraft = {
  v: number;
  /** Question ids in paper order; a draft for a different paper is ignored. */
  questionIds: string[];
  answers: UserAnswer[];
  visited: boolean[];
  currentIndex: number;
  /** Wall-clock start of the attempt (self-timed papers keep counting down). */
  startedAtMs: number;
  durationSeconds: number;
  /**
   * Malpractice strikes so far. Leaving and reopening the paper must not reset
   * them, or "Leave for Now" becomes a free way to clear the counter.
   */
  violations: number;
  /** The attempt was ended for malpractice but the submit never landed. */
  terminated: boolean;
  savedAt: number;
};

/** Strikes that end an attempt (TestInterface's 3-strike rule). */
export const TEST_MAX_VIOLATIONS = 3;

export type TestDraftInput = Omit<TestDraft, "v" | "savedAt" | "violations" | "terminated"> & {
  violations?: number;
  terminated?: boolean;
};

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Per user + paper + sitting. `scope` separates sittings of the same paper,
 * e.g. two study-room runs of one test (their server start times differ).
 */
export function testDraftKey(userId: string, testId: string, scope = "self"): string {
  return `origin_test_draft:${userId}:${testId}:${scope}`;
}

/** Seconds left on a self-timed paper, from its wall-clock start. */
export function remainingSecondsFrom(startedAtMs: number, durationSeconds: number, nowMs: number): number {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  return Math.max(0, Math.ceil((durationSeconds * 1000 - elapsed) / 1000));
}

function sameIds(a: unknown, b: string[]): boolean {
  return Array.isArray(a) && a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Validates a stored draft against the paper; null when it does not apply. */
export function parseTestDraft(raw: string | null, questionIds: string[], nowMs: number): TestDraft | null {
  if (!raw) return null;
  let data: Partial<TestDraft>;
  try {
    data = JSON.parse(raw) as Partial<TestDraft>;
  } catch {
    return null;
  }
  if (!data || data.v !== TEST_DRAFT_VERSION) return null;
  if (!sameIds(data.questionIds, questionIds)) return null;
  if (!Array.isArray(data.answers) || data.answers.length !== questionIds.length) return null;
  const startedAtMs = Number(data.startedAtMs);
  const durationSeconds = Number(data.durationSeconds);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  // Long abandoned: the paper's time ran out hours ago.
  if (nowMs - startedAtMs > durationSeconds * 1000 + TEST_DRAFT_GRACE_MS) return null;
  const visited = Array.isArray(data.visited) ? data.visited.map(Boolean) : [];
  const currentIndex = Number.isInteger(data.currentIndex)
    ? Math.min(Math.max(0, data.currentIndex as number), questionIds.length - 1)
    : 0;
  const rawViolations = Number(data.violations);
  const violations = Number.isFinite(rawViolations)
    ? Math.min(TEST_MAX_VIOLATIONS, Math.max(0, Math.floor(rawViolations)))
    : 0;
  return {
    v: TEST_DRAFT_VERSION,
    questionIds,
    answers: data.answers,
    visited: questionIds.map((_, i) => visited[i] ?? false),
    currentIndex,
    startedAtMs,
    durationSeconds,
    violations,
    terminated: data.terminated === true || violations >= TEST_MAX_VIOLATIONS,
    savedAt: Number(data.savedAt) || 0,
  };
}

export type RestoredDraftKind =
  /** Carry on: answers, position, strikes and the running clock come back. */
  | "resume"
  /**
   * A self-timed paper whose time ran out while the student was away. Never
   * auto-submitted: the student picks "resume" (submit the saved answers) or
   * "start fresh" (discard them).
   */
  | "expired"
  /** Ended for malpractice before the submit landed: it is submitted as such. */
  | "terminated";

/**
 * What to do with a restored draft. Only a self-timed paper can be "expired"
 * here: a room test runs on the server's clock, and when that says time is
 * over the paper submits itself as it always has.
 */
export function classifyRestoredDraft(
  draft: Pick<TestDraft, "startedAtMs" | "durationSeconds" | "terminated">,
  opts: { selfTimed: boolean; nowMs: number },
): RestoredDraftKind {
  if (draft.terminated) return "terminated";
  if (opts.selfTimed && remainingSecondsFrom(draft.startedAtMs, draft.durationSeconds, opts.nowMs) <= 0) {
    return "expired";
  }
  return "resume";
}

export function loadTestDraft(
  storage: DraftStorage | null,
  key: string,
  questionIds: string[],
  nowMs: number,
): TestDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    const draft = parseTestDraft(raw, questionIds, nowMs);
    if (raw && !draft) storage.removeItem(key); // stale or for another paper
    return draft;
  } catch {
    return null;
  }
}

export function saveTestDraft(
  storage: DraftStorage | null,
  key: string,
  draft: TestDraftInput,
  nowMs: number,
): void {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        ...draft,
        violations: draft.violations ?? 0,
        terminated: draft.terminated ?? false,
        v: TEST_DRAFT_VERSION,
        savedAt: nowMs,
      }),
    );
  } catch {
    // Quota or blocked storage: the exam keeps working without the mirror.
  }
}

export function clearTestDraft(storage: DraftStorage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Browser localStorage, or null where it is blocked. */
export function browserDraftStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function countAnswered(answers: UserAnswer[]): number {
  return answers.filter(
    (a) =>
      a.selectedOption != null ||
      (a.selectedOptions?.length ?? 0) > 0 ||
      (a.matrixPairs?.length ?? 0) > 0 ||
      (a.answerText ?? "").trim() !== "",
  ).length;
}

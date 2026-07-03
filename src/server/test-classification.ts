/**
 * Test classification (Phase 4 — Tests hub filters).
 *
 * The Tests hub tabs (Institute / PYQ / My Tests …) previously "filtered" by
 * matching raw title strings in the client (`title.includes('pyq')`), so PYQ and
 * exam filtering were unreliable. These helpers derive the classification once,
 * server-side, so previews expose real `isPyq` / `examType` / `origin` fields the
 * client can filter on deterministically.
 *
 * Derived (not stored) — no migration/backfill. A stored, admin/teacher-editable
 * override can layer on top later (Phase 4 follow-up) without changing callers.
 */

export type TestExamType = "jee-main" | "jee-advanced" | "neet";
export type TestOrigin = "platform" | "teacher" | "custom";

export type TestClassification = {
  isPyq: boolean;
  examType: TestExamType | null;
};

/**
 * Infer whether a test is a previous-year paper and, if identifiable, which exam
 * it belongs to, from its title + description. Ordering matters: NEET and JEE
 * Advanced are checked before JEE Main so the most specific label wins.
 */
export function classifyTest(input: { title?: string | null; description?: string | null }): TestClassification {
  const haystack = `${input.title ?? ""} ${input.description ?? ""}`.toLowerCase();

  const isPyq = /\bpyqs?\b|previous[\s-]*year|past[\s-]*paper/.test(haystack);

  let examType: TestExamType | null = null;
  if (/\bneet\b/.test(haystack)) {
    examType = "neet";
  } else if (/jee[\s-]*adv|advanced/.test(haystack)) {
    examType = "jee-advanced";
  } else if (/jee[\s-]*main|\bmains\b/.test(haystack)) {
    examType = "jee-main";
  }

  return { isPyq, examType };
}

/** Where a test came from — drives the Institute vs My Tests split. */
export function resolveTestOrigin(flags: { isCustom?: boolean; createdByTeacher?: boolean }): TestOrigin {
  if (flags.createdByTeacher) return "teacher";
  if (flags.isCustom) return "custom";
  return "platform";
}

/**
 * Convenience: the full derived classification for a preview, ready to spread
 * (both camelCase and snake_case, matching the rest of the preview payload).
 */
export function buildTestClassificationFields(input: {
  title?: string | null;
  description?: string | null;
  isCustom?: boolean;
  createdByTeacher?: boolean;
}) {
  const { isPyq, examType } = classifyTest(input);
  const origin = resolveTestOrigin(input);
  return {
    isPyq,
    is_pyq: isPyq,
    examType,
    exam_type: examType,
    origin,
  };
}

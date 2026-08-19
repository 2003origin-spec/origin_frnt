/**
 * Question of the Day — the cohort rotation.
 *
 * Exactly four questions are drawn platform-wide each day, one per subject bag
 * (class-11–12 Physics / Chemistry / Mathematics / Biology). This module decides
 * WHICH of those four a given student is shown today, from nothing but their
 * accessible subjects and the IST day number.
 *
 * A "cohort" is not a stored group. It is literally the student's accessible
 * subject set (`StudentScope.subjects` = study mode ∩ entitlements), so two
 * students with the same access are in the same cohort and see the same question
 * on the same day, and a student who gains a subject moves cohort on their very
 * next request — no recompute, no backfill, nothing to keep in sync.
 *
 *   {P}          → P, P, P, P, …
 *   {P, C}       → P, C, P, C, …
 *   {P, C, M}    → P, C, M, P, …
 *   {P, C, M, B} → P, C, M, B, …
 *
 * Because the rotation is a pure function of the day, a multi-subject student
 * consumes each of their bags at 1/n speed — they see every n-th draw from each.
 * They still never see a repeat (each day's draw is distinct within its bag's
 * cycle); they simply see a subset of a cycle before it recycles. That is the
 * intended trade for "one shared question per subject per day".
 */

import { ALL_SUBJECTS, type Subject } from "@/lib/entitlements";

/**
 * The subject whose daily draw this cohort sees on `epochDay`.
 *
 * `cohort` is re-sorted into ALL_SUBJECTS order rather than trusted as given:
 * the rotation must depend only on the SET of accessible subjects, never on the
 * order some caller happened to build the array in, or two callers holding the
 * same access could disagree about today's subject.
 *
 * Returns `null` for an empty cohort — a student starved by their study mode has
 * no subject to rotate through, and gets no card.
 */
export function subjectForDay(
  cohort: readonly Subject[],
  epochDay: number,
): Subject | null {
  const ordered = ALL_SUBJECTS.filter((subject) => cohort.includes(subject));
  if (ordered.length === 0) {
    return null;
  }
  // Guard the negative case: epochDay is only negative for pre-1970 clocks, but
  // JS `%` would then return a negative index and silently read `undefined`.
  const index = ((epochDay % ordered.length) + ordered.length) % ordered.length;
  return ordered[index];
}

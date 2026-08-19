/**
 * IST calendar days.
 *
 * Origin is an India-only product, so every "today" the student sees — streaks,
 * daily usage, the Question of the Day — rolls over at 00:00 IST, not 00:00 UTC.
 * Getting this wrong is a 5½-hour bug: a UTC day key flips at 05:30 IST, which
 * is exactly the defect this module was written to remove from the Question of
 * the Day (it used `new Date().toISOString().slice(0, 10)`).
 *
 * India has no DST and has held UTC+05:30 since 1947, so a fixed offset is
 * correct and — unlike `toLocaleDateString('en-CA', { timeZone })` — cannot be
 * perturbed by the host's ICU data.
 *
 * `src/server/gamification.ts` and `src/lib/teacher-analytics.ts` each carry a
 * private copy of this constant; folding them into this module is a follow-up,
 * deliberately out of scope here so a QOTD change cannot regress streaks or
 * teacher analytics.
 */

/** IST is UTC+05:30, year-round. */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** The IST calendar date containing `ms` (epoch millis), as `YYYY-MM-DD`. */
export function istDateKeyFromMs(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's IST calendar date as `YYYY-MM-DD`. */
export function istDateKey(now: Date | number = Date.now()): string {
  return istDateKeyFromMs(typeof now === "number" ? now : now.getTime());
}

/**
 * Whole IST days since the Unix epoch, for `ms`.
 *
 * The cohort rotation indexes into a student's subject list with this
 * (`cohort[istEpochDay() % cohort.length]`), so it must advance at exactly the
 * same instant `istDateKey` does — hence the shared offset rather than a second
 * derivation.
 */
export function istEpochDayFromMs(ms: number): number {
  return Math.floor((ms + IST_OFFSET_MS) / 86_400_000);
}

/** Whole IST days since the Unix epoch, for now. */
export function istEpochDay(now: Date | number = Date.now()): number {
  return istEpochDayFromMs(typeof now === "number" ? now : now.getTime());
}

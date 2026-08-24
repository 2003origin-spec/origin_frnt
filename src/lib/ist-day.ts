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

/**
 * UTC epoch millis of 00:00 IST on the IST calendar day `epochDay`
 * (the inverse of `istEpochDayFromMs`).
 *
 * Reporting windows need the *instant* an IST day opens, not its key: a
 * revenue query bounded by `[istDayStartMs(day), istDayStartMs(day + 1))`
 * covers exactly the rows the student-facing day contains, with none of the
 * 5½-hour drift a UTC-midnight bound would introduce.
 */
export function istDayStartMs(epochDay: number): number {
  return epochDay * 86_400_000 - IST_OFFSET_MS;
}

/**
 * UTC epoch millis of 00:00 IST on the IST calendar day `YYYY-MM-DD`.
 *
 * Throws on anything that is not a real calendar day. `Date.UTC` happily rolls
 * `2026-02-31` forward into March, so the parsed value is round-tripped through
 * `istDateKeyFromMs` and rejected unless it reproduces the input exactly.
 */
export function istDayStartMsFromKey(dateKey: string): number {
  const key = dateKey.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Not an IST date key: ${dateKey}`);
  const startMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) - IST_OFFSET_MS;
  if (!Number.isFinite(startMs) || istDateKeyFromMs(startMs) !== key) {
    throw new Error(`Not an IST date key: ${dateKey}`);
  }
  return startMs;
}

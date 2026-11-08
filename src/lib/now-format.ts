/**
 * Small Origin NOW display helpers shared by server and client (no imports).
 */

/** How far back a solver's accept time is measured (decision B90). */
export const ACCEPT_TIME_WINDOW_DAYS = 90;

/**
 * "Usually accepts in about 15 s" style text from a median accept time
 * (PRD §6 "Response: average accept time"); null when there is no history.
 * Under a minute it is rounded to 5 seconds, never below 5.
 */
export function acceptTimeText(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
  const fives = Math.max(5, Math.round(seconds / 5) * 5);
  if (fives < 60) return `accepts in about ${fives} s`;
  return `accepts in about ${Math.max(1, Math.round(seconds / 60))} min`;
}

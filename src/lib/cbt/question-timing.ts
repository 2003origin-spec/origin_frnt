/**
 * Per-question timing for a CBT attempt — pure logic, no DOM.
 *
 * The report card answers "how long did you spend on each question / section",
 * which nothing in CBT recorded before. Timing is *advisory*: it is accumulated
 * by the browser, so a hostile client can lie about it. It therefore never
 * touches a mark, a rank, or the deadline — those stay server-authoritative.
 *
 * Two properties make it survive the things that actually happen in an exam
 * hall:
 *
 *  • **Monotonic per position.** A segment only ever ADDS seconds, and merges
 *    take the max per key, so a stale tab's late `sendBeacon` can never reduce
 *    a recorded time. Resuming on another device hydrates from the server and
 *    keeps counting from there instead of restarting at zero.
 *
 *  • **Paused while the student isn't there.** Losing the network, switching
 *    tabs, or backgrounding the app stops the clock. Without this, a student
 *    who lost Wi-Fi for twenty minutes would be reported as having "spent"
 *    those twenty minutes on whatever question happened to be open.
 *
 * Everything is clamped to the room duration, so a broken/skewed device clock
 * cannot produce a 400-hour question.
 */

export type CbtQuestionTimes = Record<number, number>;

/** Ignore a segment shorter than this — it is navigation, not reading. */
const MIN_SEGMENT_SECONDS = 1;

function safeSeconds(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Drops junk keys/values so a hand-crafted payload can't poison the map. */
export function sanitizeQuestionTimes(raw: unknown, capSeconds: number): CbtQuestionTimes {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const cap = safeSeconds(capSeconds) || Number.MAX_SAFE_INTEGER;
  const out: CbtQuestionTimes = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const position = Number(key);
    if (!Number.isInteger(position) || position < 0) continue;
    const seconds = Math.min(safeSeconds(value), cap);
    if (seconds > 0) out[position] = seconds;
  }
  return out;
}

/**
 * Merges two timing maps by taking the larger value per position.
 *
 * Max — not sum — because both sides are cumulative totals for the same
 * attempt, so adding them would double-count every second the two devices
 * agree on. Max is also what makes a late write from a dead tab harmless.
 */
export function mergeQuestionTimes(
  current: CbtQuestionTimes | null | undefined,
  incoming: CbtQuestionTimes | null | undefined,
  capSeconds: number,
): CbtQuestionTimes {
  const cap = safeSeconds(capSeconds) || Number.MAX_SAFE_INTEGER;
  const merged: CbtQuestionTimes = {};
  for (const source of [current ?? {}, incoming ?? {}]) {
    for (const [key, value] of Object.entries(source)) {
      const position = Number(key);
      if (!Number.isInteger(position) || position < 0) continue;
      const seconds = Math.min(safeSeconds(value), cap);
      if (seconds <= 0) continue;
      merged[position] = Math.max(merged[position] ?? 0, seconds);
    }
  }
  return merged;
}

/**
 * The browser-side accumulator.
 *
 * `open(position)` starts a segment, `close(now)` banks it. Any transition —
 * navigating, backgrounding, going offline, submitting — is `close()` followed
 * by an optional `open()`, so there is exactly one place where seconds are
 * counted and no path that can double-count them.
 */
export class QuestionTimer {
  private times: CbtQuestionTimes;
  private activePosition: number | null = null;
  private activeSince = 0;
  private readonly capSeconds: number;

  constructor(initial: CbtQuestionTimes = {}, capSeconds = Number.MAX_SAFE_INTEGER) {
    this.capSeconds = safeSeconds(capSeconds) || Number.MAX_SAFE_INTEGER;
    this.times = sanitizeQuestionTimes(initial, this.capSeconds);
  }

  /** Banks the running segment (if any) and forgets it. Safe to call twice. */
  close(now: number): void {
    if (this.activePosition === null) return;
    const elapsed = Math.floor((now - this.activeSince) / 1000);
    if (elapsed >= MIN_SEGMENT_SECONDS) {
      const position = this.activePosition;
      const next = (this.times[position] ?? 0) + elapsed;
      this.times[position] = Math.min(next, this.capSeconds);
    }
    this.activePosition = null;
    this.activeSince = 0;
  }

  /** Closes whatever was running and starts timing `position`. */
  open(position: number, now: number): void {
    this.close(now);
    if (!Number.isInteger(position) || position < 0) return;
    this.activePosition = position;
    this.activeSince = now;
  }

  /** Which position is currently being timed (null while paused). */
  get active(): number | null {
    return this.activePosition;
  }

  /**
   * A snapshot including the segment still running, without banking it — so an
   * autosave mid-question reports the truth but a later `close()` still counts
   * exactly once.
   */
  snapshot(now: number): CbtQuestionTimes {
    const snapshot: CbtQuestionTimes = { ...this.times };
    if (this.activePosition !== null) {
      const elapsed = Math.floor((now - this.activeSince) / 1000);
      if (elapsed >= MIN_SEGMENT_SECONDS) {
        const next = (snapshot[this.activePosition] ?? 0) + elapsed;
        snapshot[this.activePosition] = Math.min(next, this.capSeconds);
      }
    }
    return snapshot;
  }

  /** Adopts a server/other-device map without losing anything counted here. */
  hydrate(incoming: CbtQuestionTimes | null | undefined): void {
    this.times = mergeQuestionTimes(this.times, incoming, this.capSeconds);
  }
}

/** Total accounted seconds across every question. */
export function totalQuestionTime(times: CbtQuestionTimes | null | undefined): number {
  if (!times) return 0;
  let total = 0;
  for (const value of Object.values(times)) total += safeSeconds(value);
  return total;
}

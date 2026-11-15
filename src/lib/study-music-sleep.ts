/**
 * BoomBoom sleep timer for the website (V1/STUDY_MUSIC_PLAN.md §7, decision
 * 15/11/2026), pure. Same rules as the app's `src/features/music/sleep-timer.ts`:
 * a wall-clock end time (a sleeping laptop or a throttled background tab still
 * stops on time at the next check), or "end of this track". The last 5 seconds
 * fade out.
 */

export const SLEEP_PRESETS_MIN = [15, 30, 45, 60] as const;
export const SLEEP_FADE_MS = 5000;
export const SLEEP_STORAGE_KEY = "origin-study-music-sleep:v1";

export type SleepTimer = { kind: "at"; endsAt: number } | { kind: "endOfTrack" } | null;
export type SleepChoice = number | "endOfTrack" | null;

export function startSleep(choice: SleepChoice, now: number): SleepTimer {
  if (choice === null) return null;
  if (choice === "endOfTrack") return { kind: "endOfTrack" };
  return { kind: "at", endsAt: now + Math.max(1, Math.round(choice)) * 60_000 };
}

export type SleepCheck = { stop: boolean; volume: number };

/** What the player does on this tick: the volume (fading over the last 5 s) and whether to stop. */
export function checkSleep(timer: SleepTimer, now: number): SleepCheck {
  if (!timer || timer.kind === "endOfTrack") return { stop: false, volume: 1 };
  const left = timer.endsAt - now;
  if (left <= 0) return { stop: true, volume: 0 };
  if (left < SLEEP_FADE_MS) return { stop: false, volume: Math.max(0, Math.min(1, left / SLEEP_FADE_MS)) };
  return { stop: false, volume: 1 };
}

/** "Stops in 12 min" text, or null when the timer is off. */
export function sleepLabel(timer: SleepTimer, now: number): string | null {
  if (!timer) return null;
  if (timer.kind === "endOfTrack") return "Stops at the end of this track";
  const min = Math.max(0, Math.ceil((timer.endsAt - now) / 60_000));
  return `Stops in ${min} min`;
}

/** A saved timer from sessionStorage; anything malformed or already over is null. */
export function parseSleep(raw: string | null, now: number): SleepTimer {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { kind?: unknown; endsAt?: unknown };
    if (v?.kind === "endOfTrack") return { kind: "endOfTrack" };
    if (v?.kind === "at" && typeof v.endsAt === "number" && Number.isFinite(v.endsAt) && v.endsAt > now && v.endsAt - now <= 61 * 60_000) {
      return { kind: "at", endsAt: v.endsAt };
    }
  } catch {
    /* corrupt value: no timer */
  }
  return null;
}

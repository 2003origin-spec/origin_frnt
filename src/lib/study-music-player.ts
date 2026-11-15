/**
 * Study Music — the website player's pure logic (V1/STUDY_MUSIC_PLAN.md §5, §7).
 *
 * A reducer with no DOM, no fetch and no timers, so every rule is unit-tested
 * (tests/unit/study-music-player.test.ts, study-music-test-guard.test.ts).
 * StudyMusicProvider wires it to one <audio> element, the API and the timers.
 *
 * Playing is decided by two things kept apart:
 *   - `intent`: what the student last asked for (play / pause);
 *   - `holds`:  who is holding the music right now (a test, a Pomodoro break).
 * Music sounds only when intent is "play" and nothing holds it. So a hold
 * pauses, and when the last hold goes the music comes back by itself — unless
 * the student pressed pause in between (intent "pause"). Pressing play during
 * a hold drops every hold: their choice wins, and nothing auto-pauses or
 * auto-resumes afterwards.
 */

import { MUSIC_MOODS, isMusicMood, isUuid, type MusicMood } from "@/lib/study-music";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  mood: MusicMood;
  durationSeconds: number;
  loopable: boolean;
  credit: { required: boolean; text: string; licenceName: string; licenceUrl: string; sourceUrl: string };
};

export type HoldKind = "test" | "break";

export type PlayerState = {
  tracks: PlayerTrack[];
  mood: MusicMood;
  /** Current track id, or null before anything was chosen. */
  trackId: string | null;
  intent: "play" | "pause";
  holds: HoldKind[];
  /** True while a fresh link is being fetched after a load error (once per failure). */
  refreshing: boolean;
  /** A load error already led to one refresh for this track. */
  refreshedOnce: boolean;
  error: string | null;
  /** The browser refused to start audio without a click (after a full reload). */
  needsGesture: boolean;
  /** Where to start the current track (restore, link refresh); consumed by the provider. */
  resumeAt: number;
};

export const INITIAL_PLAYER_STATE: PlayerState = {
  tracks: [],
  mood: "lofi",
  trackId: null,
  intent: "pause",
  holds: [],
  refreshing: false,
  refreshedOnce: false,
  error: null,
  needsGesture: false,
  resumeAt: 0,
};

export const TRACK_LOAD_ERROR = "Couldn't load this track.";

export type PlayerAction =
  | { type: "loaded"; tracks: PlayerTrack[]; defaultMood?: MusicMood }
  | { type: "setMood"; mood: MusicMood }
  | { type: "select"; trackId: string }
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "ended" }
  | { type: "hold"; kind: HoldKind }
  | { type: "release"; kind: HoldKind }
  | { type: "playing" }
  | { type: "loadError" }
  | { type: "refreshed" }
  | { type: "autoplayBlocked" }
  | { type: "positionUsed" }
  | { type: "restore"; saved: SavedPlayer; onTestPage: boolean }
  | { type: "stop" };

/** The tracks of one mood, in the order the server sent them (mood, sort order). */
export function moodQueue(tracks: readonly PlayerTrack[], mood: MusicMood): PlayerTrack[] {
  return tracks.filter((t) => t.mood === mood);
}

/** Moods that have at least one track, in the fixed mood order. */
export function availableMoods(tracks: readonly PlayerTrack[]): MusicMood[] {
  return MUSIC_MOODS.filter((m) => tracks.some((t) => t.mood === m));
}

export function currentTrack(state: Pick<PlayerState, "tracks" | "trackId">): PlayerTrack | null {
  return state.tracks.find((t) => t.id === state.trackId) ?? null;
}

/** True when the audio should be sounding right now. */
export function shouldPlay(state: Pick<PlayerState, "intent" | "holds" | "trackId" | "error">): boolean {
  return state.intent === "play" && state.holds.length === 0 && state.trackId !== null && state.error === null;
}

/** The track `step` places away in the current mood's queue, wrapping round. */
export function stepTrack(state: Pick<PlayerState, "tracks" | "mood" | "trackId">, step: 1 | -1): string | null {
  const queue = moodQueue(state.tracks, state.mood);
  if (!queue.length) return null;
  const index = queue.findIndex((t) => t.id === state.trackId);
  if (index === -1) return queue[0].id;
  return queue[(index + step + queue.length) % queue.length].id;
}

function freshTrack(state: PlayerState, trackId: string | null, resumeAt = 0): PlayerState {
  return { ...state, trackId, refreshing: false, refreshedOnce: false, error: null, resumeAt };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "loaded": {
      const tracks = action.tracks;
      const moods = availableMoods(tracks);
      const wanted = action.defaultMood && moods.includes(action.defaultMood) ? action.defaultMood : state.mood;
      const mood = moods.includes(wanted) ? wanted : (moods[0] ?? wanted);
      // A track that disappeared (retired) is dropped, and the music stops.
      const keep = state.trackId && tracks.some((t) => t.id === state.trackId) ? state.trackId : null;
      return { ...state, tracks, mood, trackId: keep, intent: keep ? state.intent : "pause" };
    }
    case "setMood": {
      if (action.mood === state.mood) return state;
      const first = moodQueue(state.tracks, action.mood)[0]?.id ?? null;
      // Switching mood while playing starts the new mood; while paused, only cues it.
      return { ...freshTrack(state, first), mood: action.mood, intent: first ? state.intent : "pause" };
    }
    case "select": {
      const track = state.tracks.find((t) => t.id === action.trackId);
      if (!track) return state;
      // Choosing a track is a "play" press: it also drops any hold.
      return { ...freshTrack(state, track.id), mood: track.mood, intent: "play", holds: [], needsGesture: false };
    }
    case "play": {
      const trackId = state.trackId ?? moodQueue(state.tracks, state.mood)[0]?.id ?? null;
      if (!trackId) return state;
      const base = state.trackId ? { ...state, error: null, refreshedOnce: false } : freshTrack(state, trackId);
      return { ...base, intent: "play", holds: [], needsGesture: false };
    }
    case "pause":
      return { ...state, intent: "pause", needsGesture: false };
    case "toggle":
      return playerReducer(state, { type: shouldPlay(state) ? "pause" : "play" });
    case "next":
    case "previous": {
      const id = stepTrack(state, action.type === "next" ? 1 : -1);
      return id ? freshTrack(state, id) : state;
    }
    case "ended": {
      const track = currentTrack(state);
      if (track?.loopable) return { ...state, resumeAt: 0 };
      const id = stepTrack(state, 1);
      return id ? freshTrack(state, id) : { ...state, intent: "pause" };
    }
    case "hold":
      return state.holds.includes(action.kind) ? state : { ...state, holds: [...state.holds, action.kind] };
    case "release":
      return state.holds.includes(action.kind) ? { ...state, holds: state.holds.filter((h) => h !== action.kind) } : state;
    case "playing":
      return { ...state, refreshing: false, refreshedOnce: false, error: null, needsGesture: false };
    case "loadError":
      // First failure: fetch a fresh link once (it may have expired). Second: give up.
      if (!state.refreshedOnce) return { ...state, refreshing: true, refreshedOnce: true };
      return { ...state, refreshing: false, error: TRACK_LOAD_ERROR, intent: "pause" };
    case "refreshed":
      return { ...state, refreshing: false };
    case "autoplayBlocked":
      return { ...state, needsGesture: true };
    case "positionUsed":
      return state.resumeAt ? { ...state, resumeAt: 0 } : state;
    case "restore": {
      const saved = action.saved;
      const track = state.tracks.find((t) => t.id === saved.trackId);
      if (!track) return state;
      // A test hold only survives a reload when we are back on a test page;
      // anywhere else it would hold the music for ever.
      const holds: HoldKind[] = saved.heldForTest && action.onTestPage ? ["test"] : [];
      const wasPlaying = saved.wasPlaying || saved.heldForTest;
      return { ...freshTrack(state, track.id, saved.position), mood: track.mood, intent: wasPlaying ? "play" : "pause", holds };
    }
    case "stop":
      return { ...freshTrack(state, null), intent: "pause", holds: [], needsGesture: false };
  }
}

// ── Saving across full page loads (sessionStorage) ──────────────────────────

export const PLAYER_STORAGE_KEY = "origin-study-music:v1";

export type SavedPlayer = { trackId: string; position: number; wasPlaying: boolean; heldForTest: boolean; mood: MusicMood };

export function toSaved(state: PlayerState, position: number): SavedPlayer | null {
  if (!state.trackId) return null;
  return {
    trackId: state.trackId,
    position: Number.isFinite(position) && position > 0 ? Math.floor(position * 10) / 10 : 0,
    wasPlaying: shouldPlay(state),
    heldForTest: state.intent === "play" && state.holds.includes("test"),
    mood: state.mood,
  };
}

/** Parses what toSaved wrote; anything else (garbage, old shape, tampering) → null. Never throws. */
export function parseSaved(raw: string | null | undefined): SavedPlayer | null {
  if (!raw || raw.length > 2000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!isUuid(v.trackId) || !isMusicMood(v.mood)) return null;
  if (typeof v.wasPlaying !== "boolean" || typeof v.heldForTest !== "boolean") return null;
  const position = typeof v.position === "number" && Number.isFinite(v.position) && v.position >= 0 && v.position <= 1200 ? v.position : 0;
  return { trackId: v.trackId, mood: v.mood, wasPlaying: v.wasPlaying, heldForTest: v.heldForTest, position };
}

// ── Tests: "Pause music for your test?" ──────────────────────────────────────

/** Seconds before the prompt applies its default (Pause). */
export const TEST_PROMPT_SECONDS = 10;

/**
 * What happens when a test starts. Never anything that could stop the test
 * starting: the caller starts the test first and only then asks this.
 *   "prompt" — music is playing and "Pause music during tests" is on;
 *   "none"   — music isn't playing, or the setting is off (it keeps playing).
 */
export function testStartAction(input: { playing: boolean; pauseDuringTests: boolean }): "prompt" | "none" {
  return input.playing && input.pauseDuringTests ? "prompt" : "none";
}

/** Text for the countdown, so it is never shown only as a bar. */
export function promptCountdownText(secondsLeft: number): string {
  return `Pausing in ${Math.max(0, Math.ceil(secondsLeft))} s`;
}

// ── Listening heartbeat ──────────────────────────────────────────────────────

/** How often a heartbeat is sent while playing. */
export const HEARTBEAT_MS = 60_000;

/**
 * Seconds of playback between two `timeupdate` readings that count as
 * listening: forward, and small (a seek or a stall is not listening time).
 */
export function listenedDelta(previous: number, current: number): number {
  const delta = current - previous;
  return delta > 0 && delta < 2.5 ? delta : 0;
}

// ── Pomodoro tie-in ──────────────────────────────────────────────────────────

export type FocusPhase = "idle" | "focus" | "break";
export type FocusSettings = { startWithFocus: boolean; stopAtBreaks: boolean };
export const DEFAULT_FOCUS_SETTINGS: FocusSettings = { startWithFocus: false, stopAtBreaks: true };

/**
 * The actions for a Pomodoro phase change (same rules as the app, plan §6.6):
 * a focus block starting plays the mood when "Start music with focus" is on
 * and releases a break hold; a break holds the music when "Stop at breaks" is
 * on; idle (reset / session over) leaves the music as it is but drops a break hold.
 */
export function focusPhaseActions(from: FocusPhase, to: FocusPhase, settings: FocusSettings, playing: boolean): PlayerAction[] {
  if (from === to) return [];
  if (to === "focus") {
    const actions: PlayerAction[] = [{ type: "release", kind: "break" }];
    if (settings.startWithFocus && !playing) actions.push({ type: "play" });
    return actions;
  }
  if (to === "break") return settings.stopAtBreaks ? [{ type: "hold", kind: "break" }] : [];
  return [{ type: "release", kind: "break" }];
}

export function parseFocusSettings(raw: string | null | undefined): FocusSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return {
      startWithFocus: typeof v.startWithFocus === "boolean" ? v.startWithFocus : DEFAULT_FOCUS_SETTINGS.startWithFocus,
      stopAtBreaks: typeof v.stopAtBreaks === "boolean" ? v.stopAtBreaks : DEFAULT_FOCUS_SETTINGS.stopAtBreaks,
    };
  } catch {
    return { ...DEFAULT_FOCUS_SETTINGS };
  }
}

// ── Where the player shows ───────────────────────────────────────────────────

/**
 * Exam surfaces: only the small play/pause button is shown there (plan §7).
 * The tests list and result pages are not exams.
 */
export function isMusicExamPath(pathname: string): boolean {
  if (/^\/tests\/.+/.test(pathname) && !/\/result\/?$/.test(pathname)) return true;
  if (/^\/study-rooms\/[^/]+\/test/.test(pathname)) return true;
  if (pathname === "/cbt" || pathname.startsWith("/cbt/")) return true;
  return /^\/contest\/[^/]+\/play\/?$/.test(pathname);
}

/** No music UI at all: admin, the teacher console, and the signed-out pages. */
export function isMusicHiddenPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) return true;
  return ["/", "/auth", "/onboarding", "/role-selection"].includes(pathname);
}

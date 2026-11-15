'use client';

/**
 * Study Music — the website player (V1/STUDY_MUSIC_PLAN.md §7). Mounted once in
 * ClientShell, inside the tree that survives client navigation, only when the
 * `studyMusic` flag is on and a student or teacher is signed in.
 *
 * One <audio preload="none"> element. No Web Audio and no `crossOrigin`, so the
 * signed R2 link needs no CORS rule. The rules live in the pure reducer
 * (src/lib/study-music-player.ts); this file only connects it to the element,
 * the API (/api/music/*), the Media Session, sessionStorage and timers.
 */

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { mutateJson } from '@/lib/csrf';
import { DEFAULT_MUSIC_PREFS, type MusicMood, type MusicPrefs } from '@/lib/study-music';
import {
  DEFAULT_FOCUS_SETTINGS,
  HEARTBEAT_MS,
  INITIAL_PLAYER_STATE,
  PLAYER_STORAGE_KEY,
  TEST_PROMPT_SECONDS,
  currentTrack,
  focusPhaseActions,
  isMusicExamPath,
  listenedDelta,
  parseFocusSettings,
  parseSaved,
  playerReducer,
  shouldPlay,
  testStartAction,
  toSaved,
  type FocusPhase,
  type FocusSettings,
  type PlayerState,
  type PlayerTrack,
} from '@/lib/study-music-player';
import { SLEEP_STORAGE_KEY, checkSleep, parseSleep, startSleep, type SleepChoice, type SleepTimer } from '@/lib/study-music-sleep';

const API = '/api/music';
const FOCUS_SETTINGS_KEY = 'origin-study-music-focus';
/** Fetch a fresh link when the cached one has less than this left. */
const LINK_MARGIN_MS = 20_000;

type Today = { seconds: number; focusSeconds: number };
type Link = { url: string; expiresAt: number };
type Prompt = { open: boolean; secondsLeft: number };

export type StudyMusicContextValue = {
  status: 'loading' | 'ready' | 'off';
  state: PlayerState;
  track: PlayerTrack | null;
  /** The element is really making sound (not just "should"). */
  audible: boolean;
  /** Intent is play but a test or a break holds the music. */
  held: boolean;
  today: Today;
  prefs: MusicPrefs;
  focusSettings: FocusSettings;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  select: (trackId: string) => void;
  setMood: (mood: MusicMood) => void;
  stop: () => void;
  setPauseDuringTests: (value: boolean) => void;
  setFocusSettings: (value: FocusSettings) => void;
  setFocusPhase: (phase: FocusPhase) => void;
  testStarted: () => void;
  testEnded: () => void;
  /** The test screen unmounted: release any test hold. */
  testLeft: () => void;
  prompt: Prompt;
  answerPrompt: (choice: 'pause' | 'keep') => void;
  /** Sleep timer: a wall-clock end time or "end of this track"; null = off. */
  sleep: SleepTimer;
  setSleep: (choice: SleepChoice) => void;
};

const StudyMusicContext = createContext<StudyMusicContextValue | null>(null);

/** The player, or null where Study Music is off (flag, role, kill switch). */
export function useStudyMusic(): StudyMusicContextValue | null {
  return useContext(StudyMusicContext);
}

function readFocusSettings(): FocusSettings {
  try {
    return parseFocusSettings(window.localStorage.getItem(FOCUS_SETTINGS_KEY));
  } catch {
    return { ...DEFAULT_FOCUS_SETTINGS };
  }
}

function readSaved() {
  try {
    return parseSaved(window.sessionStorage.getItem(PLAYER_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeSaved(state: PlayerState, position: number) {
  try {
    const saved = toSaved(state, position);
    if (saved) window.sessionStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(saved));
    else window.sessionStorage.removeItem(PLAYER_STORAGE_KEY);
  } catch {
    /* private mode / storage full: the player still works, it just won't restore */
  }
}

function writeSleep(timer: SleepTimer) {
  try {
    if (timer) window.sessionStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(timer));
    else window.sessionStorage.removeItem(SLEEP_STORAGE_KEY);
  } catch {
    /* storage blocked: the timer still works until the page reloads */
  }
}

type Session = { id: string; trackId: string; startedAt: string; seconds: number; focusSeconds: number; sent: number };

/**
 * Always mounted by ClientShell (so signing in or out never remounts the page
 * tree); `enabled` = the studyMusic flag AND a signed-in student or teacher.
 * While disabled the context is null, nothing is fetched and no audio exists.
 */
export function StudyMusicProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const [state, dispatch] = useReducer(playerReducer, INITIAL_PLAYER_STATE);
  const [status, setStatus] = useState<StudyMusicContextValue['status']>('loading');
  const [audible, setAudible] = useState(false);
  const [today, setToday] = useState<Today>({ seconds: 0, focusSeconds: 0 });
  const [prefs, setPrefs] = useState<MusicPrefs>(DEFAULT_MUSIC_PREFS);
  const [focusSettings, setFocusSettingsState] = useState<FocusSettings>(DEFAULT_FOCUS_SETTINGS);
  const [prompt, setPrompt] = useState<Prompt>({ open: false, secondsLeft: TEST_PROMPT_SECONDS });
  const [sleep, setSleepState] = useState<SleepTimer>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Latest values for callbacks and element events (synced after each render).
  const stateRef = useRef(state);
  const prefsRef = useRef(prefs);
  const sleepRef = useRef(sleep);
  const focusSettingsRef = useRef(focusSettings);
  const pathnameRef = useRef(pathname);
  useLayoutEffect(() => {
    stateRef.current = state;
    prefsRef.current = prefs;
    sleepRef.current = sleep;
    focusSettingsRef.current = focusSettings;
    pathnameRef.current = pathname;
  });
  const links = useRef(new Map<string, Link>());
  const loadedTrack = useRef<string | null>(null);
  const runToken = useRef(0);
  const restored = useRef(false);
  const focusPhase = useRef<FocusPhase>('idle');
  const testActive = useRef(false);
  const promptDeadline = useRef(0);
  const session = useRef<Session | null>(null);
  const lastTime = useRef(0);
  const lastSave = useRef(0);

  // ── Load the library ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      // Signed out (or the flag went off): stop and forget the library, the
      // saved place and the listening session, so the next account on this tab
      // starts clean (no restored track, no heartbeat under the old session id).
      setStatus('off');
      dispatch({ type: 'stop' });
      dispatch({ type: 'loaded', tracks: [] });
      setSleepState(null);
      try {
        window.sessionStorage.removeItem(PLAYER_STORAGE_KEY);
        window.sessionStorage.removeItem(SLEEP_STORAGE_KEY);
      } catch {
        /* storage blocked: nothing was saved either */
      }
      session.current = null;
      links.current.clear();
      restored.current = false;
      return;
    }
    setFocusSettingsState(readFocusSettings());
    setStatus('loading');
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/tracks`, { credentials: 'include', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { tracks: PlayerTrack[]; prefs: MusicPrefs; today: Today };
        if (cancelled) return;
        setPrefs(body.prefs);
        setToday(body.today);
        dispatch({ type: 'loaded', tracks: body.tracks, defaultMood: body.prefs.defaultMood });
        // Restore after a full page load in the SAME update as the library, so
        // nothing can save the empty state over it in between.
        if (!restored.current) {
          restored.current = true;
          const saved = readSaved();
          if (saved) dispatch({ type: 'restore', saved, onTestPage: isMusicExamPath(pathnameRef.current ?? '') });
          try {
            setSleepState(parseSleep(window.sessionStorage.getItem(SLEEP_STORAGE_KEY), Date.now()));
          } catch {
            /* storage blocked: no timer to restore */
          }
        }
        setStatus(body.tracks.length ? 'ready' : 'off');
      } catch {
        // Flag off, kill switch, signed out or offline: no music UI anywhere.
        if (!cancelled) setStatus('off');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // ── Listening heartbeat ──────────────────────────────────────────────────
  const sendHeartbeat = useCallback((final = false) => {
    const s = session.current;
    if (!s || Math.floor(s.seconds) <= s.sent) return;
    const seconds = Math.floor(s.seconds);
    s.sent = seconds;
    void mutateJson(`${API}/listen`, {
      method: 'POST',
      keepalive: final,
      body: JSON.stringify({
        sessionId: s.id,
        trackId: s.trackId,
        seconds,
        focusSeconds: Math.min(seconds, Math.floor(s.focusSeconds)),
        startedAt: s.startedAt,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as { today?: Today };
        if (body.today) setToday(body.today);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!audible) return;
    const id = window.setInterval(() => sendHeartbeat(), HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [audible, sendHeartbeat]);

  // Where the student is in the track: the element's time while it holds this
  // track, else the position still waiting to be used (a held or blocked restore).
  const position = useCallback((st: PlayerState) => {
    const audio = audioRef.current;
    if (audio && audio.getAttribute('src') && loadedTrack.current === st.trackId) return audio.currentTime;
    return st.resumeAt;
  }, []);

  // ── Drive the <audio> element ─────────────────────────────────────────────
  const fetchLink = useCallback(async (trackId: string, fresh: boolean): Promise<Link> => {
    const cached = links.current.get(trackId);
    if (!fresh && cached && cached.expiresAt - Date.now() > LINK_MARGIN_MS) return cached;
    const res = await fetch(`${API}/tracks/${trackId}/url`, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) throw new Error(`link ${res.status}`);
    const body = (await res.json()) as { url: string; expiresAt: string };
    const link = { url: body.url, expiresAt: Date.parse(body.expiresAt) };
    links.current.set(trackId, link);
    return link;
  }, []);

  const desired = shouldPlay(state);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state.refreshing) return;
    const token = ++runToken.current;
    const trackId = state.trackId;
    if (!trackId) {
      audio.pause();
      if (audio.getAttribute('src')) {
        audio.removeAttribute('src');
        audio.load();
      }
      loadedTrack.current = null;
      return;
    }
    // Blocked by the browser's autoplay rule: wait for the click on "Resume music"
    // (clearing needsGesture re-runs this effect inside that click).
    if (!desired || state.needsGesture) {
      audio.pause();
      return;
    }
    (async () => {
      try {
        const link = links.current.get(trackId);
        const stale = !link || link.expiresAt - Date.now() <= LINK_MARGIN_MS;
        // Also when the element has no source: it can be a new element (signed
        // out and back in) while the ref still names the old one's track.
        if (loadedTrack.current !== trackId || stale || !audio.getAttribute('src')) {
          // Keep the place when only the link is renewed (expired, or a load error).
          const sameTrack = loadedTrack.current === trackId || loadedTrack.current === `${trackId}:stale`;
          const keepAt = sameTrack ? audio.currentTime : 0;
          const fresh = await fetchLink(trackId, false);
          if (token !== runToken.current) return;
          audio.src = fresh.url;
          loadedTrack.current = trackId;
          const startAt = stateRef.current.resumeAt || keepAt;
          if (startAt > 0) {
            await new Promise<void>((resolve) => {
              const done = () => resolve();
              audio.addEventListener('loadedmetadata', done, { once: true });
              audio.addEventListener('error', done, { once: true });
              audio.load();
            });
            if (token !== runToken.current) return;
            if (Number.isFinite(audio.duration) && startAt < audio.duration) audio.currentTime = startAt;
            lastTime.current = audio.currentTime;
          }
          dispatch({ type: 'positionUsed' });
        }
        const track = stateRef.current.tracks.find((t) => t.id === trackId);
        // "End of this track" needs an 'ended' event, so a loopable track stops looping.
        audio.loop = Boolean(track?.loopable) && sleepRef.current?.kind !== 'endOfTrack';
        await audio.play();
      } catch (error) {
        if (token !== runToken.current) return;
        if ((error as { name?: string })?.name === 'NotAllowedError') dispatch({ type: 'autoplayBlocked' });
        else if ((error as { name?: string })?.name !== 'AbortError') dispatch({ type: 'loadError' });
      }
    })();
  }, [state.trackId, desired, state.refreshing, state.needsGesture, fetchLink]);

  // A load error: renew the link once, keep the position, try again.
  useEffect(() => {
    if (!state.refreshing) return;
    const audio = audioRef.current;
    const trackId = state.trackId;
    if (trackId) links.current.delete(trackId);
    // Forces the driver to set a new src; it keeps the place via currentTime.
    if (audio && loadedTrack.current === trackId) loadedTrack.current = `${trackId}:stale`;
    dispatch({ type: 'refreshed' });
  }, [state.refreshing, state.trackId]);

  // Element events → reducer, heartbeat, saved state.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlaying = () => {
      setAudible(true);
      dispatch({ type: 'playing' });
      const trackId = stateRef.current.trackId;
      if (trackId && session.current?.trackId !== trackId) {
        sendHeartbeat(true);
        session.current = { id: crypto.randomUUID(), trackId, startedAt: new Date().toISOString(), seconds: 0, focusSeconds: 0, sent: 0 };
      }
      lastTime.current = audio.currentTime;
    };
    const onPause = () => {
      setAudible(false);
      sendHeartbeat();
    };
    const onEnded = () => {
      setAudible(false);
      sendHeartbeat();
      if (sleepRef.current?.kind === 'endOfTrack') {
        // Sleep timer "end of this track": stop here instead of moving on.
        setSleepState(null);
        writeSleep(null);
        // Next play starts this track again from the top (a loopable element
        // sitting at its end does not rewind by itself in every browser).
        audio.currentTime = 0;
        lastTime.current = 0;
        dispatch({ type: 'pause' });
        return;
      }
      dispatch({ type: 'ended' });
    };
    const onError = () => {
      if (!audio.getAttribute('src')) return;
      setAudible(false);
      dispatch({ type: 'loadError' });
    };
    const onTime = () => {
      const delta = listenedDelta(lastTime.current, audio.currentTime);
      lastTime.current = audio.currentTime;
      const s = session.current;
      if (s && !audio.paused && delta > 0) {
        s.seconds += delta;
        if (focusPhase.current === 'focus') s.focusSeconds += delta;
      }
      if (restored.current && Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        writeSaved(stateRef.current, position(stateRef.current));
      }
    };
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('timeupdate', onTime);
    return () => {
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('timeupdate', onTime);
    };
    // `enabled`: the element only exists while the player is on.
  }, [sendHeartbeat, enabled, position]);

  // Save on every state change and when the page goes away.
  useEffect(() => {
    if (status !== 'ready' || !restored.current) return;
    writeSaved(state, position(state));
  }, [state, status, position]);

  useEffect(() => {
    const onHide = () => {
      // Before the library (and the saved state) loaded there is nothing to save:
      // writing now would wipe what the last page saved.
      if (restored.current) writeSaved(stateRef.current, position(stateRef.current));
      sendHeartbeat(true);
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [sendHeartbeat, position]);

  // ── Sleep timer ───────────────────────────────────────────────────────────
  const setSleep = useCallback((choice: SleepChoice) => {
    const timer = startSleep(choice, Date.now());
    setSleepState(timer);
    writeSleep(timer);
  }, []);

  // Loop follows the timer: off while "end of this track" waits for 'ended'.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const loopable = Boolean(currentTrack(stateRef.current)?.loopable);
    audio.loop = loopable && sleep?.kind !== 'endOfTrack';
  }, [sleep, state.trackId]);

  // A timed stop: checked against the clock (a throttled background tab still
  // stops at its next tick), fading the last 5 seconds.
  useEffect(() => {
    const audio = audioRef.current;
    if (sleep?.kind !== 'at') {
      if (audio) audio.volume = 1;
      return;
    }
    const tick = () => {
      const check = checkSleep(sleep, Date.now());
      if (audio) audio.volume = check.volume;
      if (check.stop) {
        dispatch({ type: 'pause' });
        setSleepState(null);
        writeSleep(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => {
      window.clearInterval(id);
      if (audio) audio.volume = 1;
    };
  }, [sleep]);

  // ── Media Session (media keys, mobile lock screen) ────────────────────────
  const track = currentTrack(state);
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (!track) {
      ms.metadata = null;
      return;
    }
    try {
      ms.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: 'BoomBoom by Origin' });
      ms.setActionHandler('play', () => dispatch({ type: 'play' }));
      ms.setActionHandler('pause', () => dispatch({ type: 'pause' }));
      ms.setActionHandler('nexttrack', () => dispatch({ type: 'next' }));
      ms.setActionHandler('previoustrack', () => dispatch({ type: 'previous' }));
    } catch {
      /* an older browser without some actions */
    }
  }, [track]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = audible ? 'playing' : track ? 'paused' : 'none';
    }
  }, [audible, track]);

  // ── Tests: "Pause music for your test?" ──────────────────────────────────
  const answerPrompt = useCallback((choice: 'pause' | 'keep') => {
    setPrompt({ open: false, secondsLeft: TEST_PROMPT_SECONDS });
    promptDeadline.current = 0;
    if (choice === 'pause' && testActive.current) dispatch({ type: 'hold', kind: 'test' });
  }, []);

  const testStarted = useCallback(() => {
    if (testActive.current) return;
    testActive.current = true;
    const now = stateRef.current;
    const action = testStartAction({ playing: shouldPlay(now) && !now.needsGesture, pauseDuringTests: prefsRef.current.pauseDuringTests });
    if (action !== 'prompt') return;
    promptDeadline.current = Date.now() + TEST_PROMPT_SECONDS * 1000;
    setPrompt({ open: true, secondsLeft: TEST_PROMPT_SECONDS });
  }, []);

  const testEnded = useCallback(() => {
    if (!testActive.current) return;
    testActive.current = false;
    promptDeadline.current = 0;
    setPrompt({ open: false, secondsLeft: TEST_PROMPT_SECONDS });
    dispatch({ type: 'release', kind: 'test' });
  }, []);

  /**
   * The test screen is gone (unmount): always release a test hold, including one
   * restored after a full reload that this screen never started itself.
   */
  const testLeft = useCallback(() => {
    testActive.current = false;
    promptDeadline.current = 0;
    setPrompt({ open: false, secondsLeft: TEST_PROMPT_SECONDS });
    dispatch({ type: 'release', kind: 'test' });
  }, []);

  useEffect(() => {
    if (!prompt.open) return;
    const id = window.setInterval(() => {
      const left = (promptDeadline.current - Date.now()) / 1000;
      if (left <= 0) answerPrompt('pause');
      else setPrompt((p) => (p.open ? { ...p, secondsLeft: left } : p));
    }, 250);
    return () => window.clearInterval(id);
  }, [prompt.open, answerPrompt]);

  // ── Pomodoro and settings ─────────────────────────────────────────────────
  const setFocusPhase = useCallback((phase: FocusPhase) => {
    const from = focusPhase.current;
    focusPhase.current = phase;
    for (const action of focusPhaseActions(from, phase, focusSettingsRef.current, shouldPlay(stateRef.current))) dispatch(action);
  }, []);

  const setFocusSettings = useCallback((value: FocusSettings) => {
    setFocusSettingsState(value);
    try {
      window.localStorage.setItem(FOCUS_SETTINGS_KEY, JSON.stringify(value));
    } catch {
      /* per-device convenience only */
    }
    if (!value.stopAtBreaks) dispatch({ type: 'release', kind: 'break' });
  }, []);

  // Only the latest toggle's answer may change the switch (a slow or failed
  // older request must not undo a newer choice).
  const prefsRequest = useRef(0);
  const setPauseDuringTests = useCallback((value: boolean) => {
    const id = ++prefsRequest.current;
    const before = prefsRef.current.pauseDuringTests;
    setPrefs((p) => ({ ...p, pauseDuringTests: value }));
    void mutateJson(`${API}/prefs`, { method: 'PUT', body: JSON.stringify({ pauseDuringTests: value }) })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { prefs?: MusicPrefs };
        // Only a well-formed answer replaces the prefs (an empty body must not wipe them).
        if (id === prefsRequest.current && body.prefs && typeof body.prefs.pauseDuringTests === 'boolean') setPrefs(body.prefs);
      })
      .catch(() => {
        if (id === prefsRequest.current) setPrefs((p) => ({ ...p, pauseDuringTests: before }));
      });
  }, []);

  const value = useMemo<StudyMusicContextValue>(
    () => ({
      status,
      state,
      track,
      audible,
      held: state.intent === 'play' && state.holds.length > 0,
      today,
      prefs,
      focusSettings,
      play: () => dispatch({ type: 'play' }),
      pause: () => dispatch({ type: 'pause' }),
      toggle: () => dispatch({ type: 'toggle' }),
      next: () => dispatch({ type: 'next' }),
      previous: () => dispatch({ type: 'previous' }),
      select: (trackId: string) => dispatch({ type: 'select', trackId }),
      setMood: (mood: MusicMood) => dispatch({ type: 'setMood', mood }),
      stop: () => {
        sendHeartbeat();
        setSleep(null);
        dispatch({ type: 'stop' });
      },
      setPauseDuringTests,
      setFocusSettings,
      setFocusPhase,
      testStarted,
      testEnded,
      testLeft,
      prompt,
      answerPrompt,
      sleep,
      setSleep,
    }),
    [status, state, track, audible, today, prefs, focusSettings, setPauseDuringTests, setFocusSettings, setFocusPhase, testStarted, testEnded, testLeft, prompt, answerPrompt, sendHeartbeat, sleep, setSleep],
  );

  return (
    <StudyMusicContext.Provider value={enabled ? value : null}>
      {children}
      {/* The one audio element. Plain src, no crossOrigin, no Web Audio. */}
      {enabled && <audio ref={audioRef} preload="none" hidden />}
    </StudyMusicContext.Provider>
  );
}

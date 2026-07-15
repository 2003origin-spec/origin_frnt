// Client-only sound playback. Holds the active user's preferences in a module
// singleton (set from AuthContext) so any surface can fire a category sound
// without prop-drilling. Respects master mute + volume and autoplay policies.
import {
  DEFAULT_SOUND_PREFERENCES,
  normalizeSoundPreferences,
  soundSrc,
  type SoundCategoryKey,
  type SoundPreferences,
} from './sound-preferences';

let prefs: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
let sharedAudio: HTMLAudioElement | null = null;
let correctStreak = 0;
let wrongStreak = 0;
let unlockArmed = false;

// A tiny valid silent WAV — played (muted) inside the first user gesture to
// "unlock" the shared <audio> element. Browsers (esp. iOS Safari) block audio
// that isn't started from a gesture; our answer/notification sounds fire AFTER
// an awaited server call, so the gesture context is gone by then. Priming the
// element once keeps every later play() allowed.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

/** Sync the active user's stored preferences (called from AuthContext). */
export function setSoundPreferences(raw: unknown): void {
  prefs = normalizeSoundPreferences(raw);
}

export function getActiveSoundPreferences(): SoundPreferences {
  return prefs;
}

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) sharedAudio = new Audio();
  return sharedAudio;
}

/**
 * Arm a one-time unlock on the first user gesture so the shared audio element
 * is primed and later programmatic plays (fired after awaits) are permitted.
 * Call once from the app shell.
 */
export function armSoundUnlock(): void {
  if (typeof window === 'undefined' || unlockArmed) return;
  unlockArmed = true;
  const unlock = () => {
    const el = ensureAudio();
    if (el) {
      try {
        el.muted = true;
        el.src = SILENT_WAV;
        void el
          .play()
          .then(() => {
            el.pause();
            el.currentTime = 0;
            el.muted = false;
          })
          .catch(() => {
            el.muted = false;
          });
      } catch {
        el.muted = false;
      }
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

function play(src: string | null): void {
  if (!src || prefs.muted || typeof window === 'undefined') return;
  const el = ensureAudio();
  if (!el) return;
  try {
    el.pause();
    el.muted = false;
    el.src = src;
    el.currentTime = 0;
    el.volume = Math.min(1, Math.max(0, prefs.volume));
    void el.play().catch(() => {});
  } catch {
    /* ignore playback errors */
  }
}

/** Fire the sound configured for a category (no-op when set to None / muted). */
export function playCategory(key: SoundCategoryKey): void {
  play(soundSrc(key, prefs[key]));
}

/**
 * Play the correct/wrong answer sound, upgrading to the streak sound on every
 * 3rd consecutive correct/wrong answer. Call resetAnswerStreak() when a new
 * session/quiz starts.
 */
export function playAnswerSound(correct: boolean): void {
  if (correct) {
    correctStreak += 1;
    wrongStreak = 0;
    if (correctStreak % 3 === 0 && prefs.streak3Correct) {
      playCategory('streak3Correct');
      return;
    }
    playCategory('correct');
  } else {
    wrongStreak += 1;
    correctStreak = 0;
    if (wrongStreak % 3 === 0 && prefs.streak3Wrong) {
      playCategory('streak3Wrong');
      return;
    }
    playCategory('wrong');
  }
}

export function resetAnswerStreak(): void {
  correctStreak = 0;
  wrongStreak = 0;
}

// Independent element so a settings preview never interrupts gameplay audio.
let previewEl: HTMLAudioElement | null = null;

/** Play an explicit source for the settings preview button. */
export function previewSound(src: string, volume = 0.7): void {
  if (typeof window === 'undefined') return;
  try {
    previewEl?.pause();
    previewEl = new Audio(src);
    previewEl.volume = Math.min(1, Math.max(0, volume));
    void previewEl.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

export function stopPreview(): void {
  previewEl?.pause();
}

// Server- and client-safe sound-preference model. No React / lucide imports so
// it can be used from server modules (db-users, store, serializers) too.

export const SOUND_CATEGORY_KEYS = [
  'correct',
  'wrong',
  'streak3Correct',
  'streak3Wrong',
  'fullScore',
  'badScore',
  'notification',
  'signIn',
  'warning',
] as const;

export type SoundCategoryKey = (typeof SOUND_CATEGORY_KEYS)[number];

/** Per-category chosen file (null = off) plus master mute + volume. */
export type SoundPreferences = {
  [K in SoundCategoryKey]: string | null;
} & {
  muted: boolean;
  volume: number;
};

/** Public folder (exact case, may contain spaces) for each category. */
export const SOUND_FOLDERS: Record<SoundCategoryKey, string> = {
  correct: 'Correct',
  wrong: 'Wrong',
  streak3Correct: 'After 3 Correct',
  streak3Wrong: 'After 3 Wrong',
  fullScore: 'Full score in test',
  badScore: 'Bad Score in test',
  notification: 'Notification inside app',
  signIn: 'Sign In',
  warning: 'Warning',
};

// Tasteful defaults so answer/notification sounds play out of the box. Users
// can switch any category to "None" from Settings (the option is always there).
export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  correct: 'success-chime.mp3',
  wrong: 'fail-buzzer.mp3',
  streak3Correct: '3 correct 4.mp3',
  streak3Wrong: '3 wrong 1.mp3',
  fullScore: 'full score in test 8.mp3',
  badScore: 'bad score 1.mp3',
  notification: 'notification 1.mp3',
  signIn: 'sign in 1.mp3',
  warning: 'Warning 1.mp3',
  muted: false,
  volume: 0.7,
};

/** Public URL for a category's chosen file (exact folder case, URL-encoded). */
export function soundSrc(key: SoundCategoryKey, file: string | null | undefined): string | null {
  if (!file) return null;
  return `/sounds/${encodeURIComponent(SOUND_FOLDERS[key])}/${encodeURIComponent(file)}`;
}

/** Coerce arbitrary stored JSON into a complete, valid SoundPreferences. */
export function normalizeSoundPreferences(raw: unknown): SoundPreferences {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: SoundPreferences = { ...DEFAULT_SOUND_PREFERENCES };
  for (const key of SOUND_CATEGORY_KEYS) {
    if (key in obj) {
      const v = obj[key];
      out[key] = typeof v === 'string' && v.trim() ? v : null;
    }
  }
  if (typeof obj.muted === 'boolean') out.muted = obj.muted;
  if (typeof obj.volume === 'number' && obj.volume >= 0 && obj.volume <= 1) {
    out.volume = obj.volume;
  }
  return out;
}

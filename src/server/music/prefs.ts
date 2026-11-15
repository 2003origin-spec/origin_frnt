/**
 * Study Music — per-user prefs (music.user_prefs): "Pause music during tests"
 * and the default mood. A user without a row gets DEFAULT_MUSIC_PREFS.
 */

import { DEFAULT_MUSIC_PREFS, type MusicMood, type MusicPrefs } from "@/lib/study-music";

import { musicDb } from "./tracks";

type PrefsRow = { pause_during_tests: boolean; default_mood: MusicMood };

function toPrefs(row: PrefsRow | undefined): MusicPrefs {
  if (!row) return { ...DEFAULT_MUSIC_PREFS };
  return { pauseDuringTests: row.pause_during_tests, defaultMood: row.default_mood };
}

export async function getMusicPrefs(userId: string): Promise<MusicPrefs> {
  const p = await musicDb();
  const { rows } = await p.query<PrefsRow>(
    `SELECT pause_during_tests, default_mood FROM music.user_prefs WHERE user_id = $1`,
    [userId],
  );
  return toPrefs(rows[0]);
}

/** Saves only the fields given; the others keep their stored (or default) value. */
export async function saveMusicPrefs(userId: string, patch: Partial<MusicPrefs>): Promise<MusicPrefs> {
  const p = await musicDb();
  const { rows } = await p.query<PrefsRow>(
    `INSERT INTO music.user_prefs (user_id, pause_during_tests, default_mood, updated_at)
     VALUES ($1, COALESCE($2::boolean, true), COALESCE($3::text, 'lofi'), now())
     ON CONFLICT (user_id) DO UPDATE SET
       pause_during_tests = COALESCE($2::boolean, music.user_prefs.pause_during_tests),
       default_mood       = COALESCE($3::text, music.user_prefs.default_mood),
       updated_at         = now()
     RETURNING pause_during_tests, default_mood`,
    [userId, patch.pauseDuringTests ?? null, patch.defaultMood ?? null],
  );
  return toPrefs(rows[0]);
}

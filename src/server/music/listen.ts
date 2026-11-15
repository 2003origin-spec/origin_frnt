/**
 * Study Music — listening time (music.listen_sessions), V1/STUDY_MUSIC_PLAN.md §4.5.
 *
 * The player sends a heartbeat with the session's running totals. The server
 * keeps the larger value (safe to resend, a lower value never shrinks it) and
 * caps `seconds` at the wall-clock time since the session started + 60 s, so
 * time can't be inflated beyond real time; all of a user's sessions started
 * today together stay within the seconds since IST midnight. `focus_seconds`
 * never exceeds `seconds`. Listening time gives no points and no streak (decision D5).
 *
 * A device may say when the session started (`startedAt`, clamped by
 * parseListenInput to the last 24 h) so a heartbeat queued offline, or the
 * app's first 5-minute heartbeat, is not cut to 60 s. Without it the session
 * starts now.
 */

import type { ListenInput, MusicPlatform } from "@/lib/study-music";

import { MusicError } from "./rules";
import { musicDb } from "./tracks";

export type MusicToday = { seconds: number; focusSeconds: number };

/** Start of the current IST day, as SQL. */
const IST_TODAY = `(date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')`;

export async function getMusicToday(userId: string): Promise<MusicToday> {
  const p = await musicDb();
  const { rows } = await p.query<{ seconds: string | number; focus_seconds: string | number }>(
    `SELECT COALESCE(SUM(seconds), 0) AS seconds, COALESCE(SUM(focus_seconds), 0) AS focus_seconds
       FROM music.listen_sessions
      WHERE user_id = $1 AND started_at >= ${IST_TODAY}`,
    [userId],
  );
  return { seconds: Number(rows[0]?.seconds ?? 0), focusSeconds: Number(rows[0]?.focus_seconds ?? 0) };
}

/**
 * Records one heartbeat. 404 when the track doesn't exist (or is a draft), or
 * when the session id belongs to another user or another track.
 */
export async function recordListen(userId: string, platform: MusicPlatform, input: ListenInput): Promise<MusicToday> {
  const p = await musicDb();
  // cap(started) = whole seconds since `started` + 60
  const capFrom = (started: string) => `(floor(EXTRACT(EPOCH FROM (now() - ${started}))))::int + 60`;
  // The whole day can't hold more listening than the day had: for a session
  // started today, the user's OTHER sessions today plus this one stay within the
  // seconds since IST midnight + 60. (Without this, many fresh session ids
  // backdated to midnight could each claim the full day.)
  const dayCap = (started: string) => `CASE WHEN ${started} >= ${IST_TODAY} THEN GREATEST(0,
      ${capFrom(IST_TODAY)} - (SELECT COALESCE(SUM(o.seconds), 0)::int FROM music.listen_sessions o
                               WHERE o.user_id = $2 AND o.id <> $1::uuid AND o.started_at >= ${IST_TODAY}))
    ELSE 2147483647 END`;
  const newSeconds = (started: string) => `LEAST($5::int, ${capFrom(started)}, ${dayCap(started)})`;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO music.listen_sessions (id, user_id, track_id, platform, started_at, seconds, focus_seconds, updated_at)
     SELECT $1, $2, t.id, $3, s.started,
            ${newSeconds("s.started")},
            LEAST($6::int, ${newSeconds("s.started")}),
            now()
       FROM music.tracks t
      CROSS JOIN (SELECT COALESCE($7::timestamptz, now()) AS started) s
      WHERE t.id = $4 AND t.status IN ('published', 'retired')
     ON CONFLICT (id) DO UPDATE SET
       seconds = GREATEST(music.listen_sessions.seconds, ${newSeconds("music.listen_sessions.started_at")}),
       focus_seconds = LEAST(
         GREATEST(music.listen_sessions.focus_seconds, $6::int),
         GREATEST(music.listen_sessions.seconds, ${newSeconds("music.listen_sessions.started_at")})
       ),
       updated_at = now()
     WHERE music.listen_sessions.user_id = $2 AND music.listen_sessions.track_id = $4
     RETURNING id`,
    [input.sessionId, userId, platform, input.trackId, input.seconds, input.focusSeconds, input.startedAt?.toISOString() ?? null],
  );
  if (!rows.length) throw new MusicError(404, "not_found", "That listening session or track was not found.");
  return getMusicToday(userId);
}

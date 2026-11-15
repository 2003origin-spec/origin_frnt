/**
 * Study Music — the student API, one service with two doors
 * (V1/STUDY_MUSIC_PLAN.md §4.6):
 *   website  /api/music/*         (src/app/api/music/[[...slug]]/route.ts, cookie session + CSRF)
 *   app      /api/mobile/music/*  (src/server/mobile/app-api.ts, bearer token)
 *
 *   GET  tracks            → { tracks, prefs, today }      published only, Cache-Control private 300 s
 *   GET  tracks/:id/url    → { url, expiresAt }            1-hour signed link, 300 per user per hour
 *   PUT  prefs             { pauseDuringTests?, defaultMood? } → { prefs }
 *   POST listen            { sessionId, trackId, seconds, focusSeconds, startedAt? } → { today }
 *
 * Every request: the `studyMusic` flag (runtime, so the /admin/incidents switch
 * works here too), then a student or teacher session (decision D6). Admins get
 * 403 here: they preview tracks from /admin/music. Refusals are { detail, code }.
 */

import { NextResponse, type NextRequest } from "next/server";

import { FeatureDisabledError } from "@/lib/feature-flags";
import { checkRateLimit, musicUrlLimiter } from "@/lib/rate-limit";
import {
  MUSIC_PLAY_LINK_SECONDS,
  isUuid,
  parseListenInput,
  parsePrefsInput,
  type MusicPlatform,
} from "@/lib/study-music";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { AuthzError, authzErrorResponse, requireRole } from "@/server/authz";
import { requireFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { parseJsonBody } from "@/server/http";
import { createPresignedR2PutUrl } from "@/server/media-storage";

import { getMusicToday, recordListen } from "./listen";
import { getMusicPrefs, saveMusicPrefs } from "./prefs";
import { MusicError } from "./rules";
import { findTrack, listPublishedTracks, musicBucket, studentTrack } from "./tracks";

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await parseJsonBody<unknown>(request);
  } catch {
    throw new MusicError(400, "invalid_body", "Invalid JSON body.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new MusicError(400, "invalid_body", "Send a JSON object.");
  return body as Record<string, unknown>;
}

function refuse(error: MusicError): Response {
  return NextResponse.json({ detail: error.message, code: error.code }, { status: error.status });
}

async function listTracks(userId: string): Promise<Response> {
  const [rows, prefs, today] = await Promise.all([listPublishedTracks(), getMusicPrefs(userId), getMusicToday(userId)]);
  return NextResponse.json(
    { tracks: rows.map(studentTrack), prefs, today },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}

/**
 * Play-link lifetime. 1 hour; outside production STUDY_MUSIC_LINK_SECONDS may
 * shorten it (60–3600) so the player's link refresh can be tested locally.
 */
export function playLinkSeconds(env: Record<string, string | undefined> = process.env): number {
  if (env.NODE_ENV === "production") return MUSIC_PLAY_LINK_SECONDS;
  const raw = Number(env.STUDY_MUSIC_LINK_SECONDS);
  return Number.isInteger(raw) && raw >= 60 && raw <= MUSIC_PLAY_LINK_SECONDS ? raw : MUSIC_PLAY_LINK_SECONDS;
}

async function trackUrl(userId: string, id: string): Promise<Response> {
  // A bad id is "not found", like a missing track (no hint about what exists).
  if (!isUuid(id)) throw new MusicError(404, "not_found", "Track not found.");
  const limited = await checkRateLimit(musicUrlLimiter, `music-url:${userId}`, { honorIncidentMode: false });
  if (limited) return limited;
  const track = await findTrack(id);
  if (!track || track.status !== "published") throw new MusicError(404, "not_found", "Track not found.");
  const seconds = playLinkSeconds();
  const signed = createPresignedR2PutUrl({
    method: "GET",
    bucket: musicBucket(),
    objectKey: track.object_key,
    expiresSeconds: seconds,
  });
  // The link is a credential for an hour: never logged, never cached by a shared cache.
  return NextResponse.json(
    { url: signed.url, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

async function route(method: string, request: NextRequest, slug: string[], userId: string, platform: MusicPlatform): Promise<Response | null> {
  const [head, id, action] = slug;
  if (method === "GET" && slug.length === 1 && head === "tracks") return listTracks(userId);
  if (method === "GET" && slug.length === 3 && head === "tracks" && action === "url") return trackUrl(userId, id);
  if (method === "PUT" && slug.length === 1 && head === "prefs") {
    const parsed = parsePrefsInput(await readBody(request));
    if (!parsed.ok) throw new MusicError(400, "invalid_prefs", parsed.error);
    return NextResponse.json({ prefs: await saveMusicPrefs(userId, parsed.value) });
  }
  if (method === "POST" && slug.length === 1 && head === "listen") {
    const parsed = parseListenInput(await readBody(request));
    if (!parsed.ok) throw new MusicError(400, "invalid_listen", parsed.error);
    return NextResponse.json({ today: await recordListen(userId, platform, parsed.value) });
  }
  return null;
}

/**
 * Dispatch one music request. `slug` is the path AFTER "music" (both doors
 * strip it). Returns null for an unknown path or method; the caller answers 404.
 */
export async function handleMusicApi(method: string, request: NextRequest, slug: string[], platform: MusicPlatform): Promise<Response | null> {
  try {
    await requireFeatureEnabledRuntime("studyMusic");
    const auth = await requireRole(request, ["student", "teacher"]);
    return await route(method, request, slug, auth.userId, platform);
  } catch (error) {
    if (error instanceof FeatureDisabledError) {
      return NextResponse.json({ detail: "BoomBoom is not available yet.", code: "feature_disabled" }, { status: 404 });
    }
    if (error instanceof MusicError) return refuse(error);
    if (error instanceof AuthzError || isAuthServiceUnavailableError(error)) return authzErrorResponse(error);
    throw error;
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { AuthzError, authzErrorResponse, requireAdmin } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import {
  createTrack,
  deleteTrack,
  listAdminTracks,
  presignMusicUpload,
  previewUrl,
  publishTrack,
  retireTrack,
  updateTrack,
} from "@/server/music/admin";
import { MusicError } from "@/server/music/rules";

/**
 * Study Music admin (Admin → Study Music), V1/STUDY_MUSIC_PLAN.md §4.7. One
 * optional catch-all route file (the Next 16 new-route-404 rule). "/api/admin"
 * is only "authenticated" at the edge (CSRF + mutation limiter there), so EVERY
 * handler calls requireAdmin (with the fresh-principal check). NOT behind the
 * studyMusic flag or its kill switch: founders upload while the feature is dark.
 *
 *   GET    /api/admin/music                          → { tracks, storageBytes, studentsCanSee }
 *   POST   /api/admin/music/presign                  { kind, contentType, size } → { uploadUrl, uploadHeaders, objectKey, uploadToken }
 *   POST   /api/admin/music/tracks                   { objectKey, uploadToken, sha256, title, artist, mood, durationSeconds,
 *                                                      loopable?, allowOffline?, sortOrder?, sourceUrl, licenceName, licenceUrl,
 *                                                      attributionRequired, attributionText, proofKey?, proofToken? } → { track }
 *   PATCH  /api/admin/music/tracks/:id               fields above except the upload, plus proofKey/proofToken → { track }
 *   POST   /api/admin/music/tracks/:id/publish       → { track }
 *   POST   /api/admin/music/tracks/:id/retire        → { track }
 *   DELETE /api/admin/music/tracks/:id               → { deleted: true }   (draft or retired only)
 *   GET    /api/admin/music/tracks/:id/preview-url[?what=proof] → { url, expiresAt } (5 minutes)
 *
 * Refusals are { detail, code }.
 */

// Creating a track reads the uploaded file back (≤ 15 MB) to check it.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ slug?: string[] }> };

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

async function route(method: string, request: NextRequest, slug: string[], adminId: string): Promise<Response | null> {
  const [head, id, action] = slug;
  if (method === "GET" && slug.length === 0) return NextResponse.json(await listAdminTracks());
  if (method === "POST" && slug.length === 1 && head === "presign") {
    return NextResponse.json(presignMusicUpload(adminId, await readBody(request)), { headers: { "Cache-Control": "no-store" } });
  }
  if (head !== "tracks") return null;
  if (method === "POST" && slug.length === 1) {
    return NextResponse.json({ track: await createTrack(adminId, await readBody(request)) }, { status: 201 });
  }
  if (method === "PATCH" && slug.length === 2) return NextResponse.json({ track: await updateTrack(adminId, id, await readBody(request)) });
  if (method === "DELETE" && slug.length === 2) return NextResponse.json(await deleteTrack(adminId, id));
  if (method === "POST" && slug.length === 3 && action === "publish") return NextResponse.json({ track: await publishTrack(adminId, id) });
  if (method === "POST" && slug.length === 3 && action === "retire") return NextResponse.json({ track: await retireTrack(adminId, id) });
  if (method === "GET" && slug.length === 3 && action === "preview-url") {
    const what = request.nextUrl.searchParams.get("what") === "proof" ? "proof" : "audio";
    return NextResponse.json(await previewUrl(id, what), { headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await requireAdmin(request);
    const slug = getSlugSegments(await context.params);
    return (await route(method, request, slug, auth.userId)) ?? NextResponse.json({ detail: "Not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof MusicError) return NextResponse.json({ detail: error.message, code: error.code }, { status: error.status });
    if (error instanceof AuthzError || isAuthServiceUnavailableError(error)) return authzErrorResponse(error);
    console.error("[admin music] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return dispatch("PATCH", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}

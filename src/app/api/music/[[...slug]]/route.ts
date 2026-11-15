import { NextResponse, type NextRequest } from "next/server";

import { getAuthContext } from "@/server/authz";
import { getSlugSegments, notFound } from "@/server/http";
import { handleMusicApi } from "@/server/music/student-api";
import { checkSharedMutationLimit } from "@/server/shared-mutation-limit";

/**
 * Study Music for the website: the same routes and shapes as
 * `/api/mobile/music/*`, served by the same handler
 * (src/server/music/student-api.ts). V1/STUDY_MUSIC_PLAN.md §4.6.
 *
 *   GET  /api/music/tracks
 *   GET  /api/music/tracks/:id/url
 *   PUT  /api/music/prefs
 *   POST /api/music/listen
 *
 * Edge: "/api/music" is an authenticated prefix (src/server/route-policy.ts);
 * the middleware verifies the cookie session, checks CSRF on writes and
 * refuses everything while the `studyMusic` kill-switch is on. Writes charge
 * the shared per-user mutation budget HERE, not at the edge
 * (HANDLER_LIMITED_MUTATION_PREFIXES). The handler checks the flag and the role.
 *
 * Optional catch-all, one route file for the whole surface (the Next 16
 * new-route-404 rule, AGENTS.md).
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await getAuthContext(request);
    const limited = await checkSharedMutationLimit(request, auth?.userId);
    if (limited) return limited;
    const slug = getSlugSegments(await context.params);
    return (await handleMusicApi(method, request, slug, "web")) ?? notFound();
  } catch (error) {
    console.error("[music] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

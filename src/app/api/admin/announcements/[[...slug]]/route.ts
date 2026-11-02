import { NextResponse, type NextRequest } from "next/server";

import { listAnnouncements, previewReach, requireAudience, requireDraft, sendAnnouncement } from "@/server/announcements/admin";
import { AnnouncementError } from "@/server/announcements/rules";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { AuthzError, authzErrorResponse, requireAdmin } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";

/**
 * Admin announcements (Admin → Announcements). One optional catch-all route
 * file (the Next 16 new-route-404 rule). "/api/admin" is an authenticated
 * prefix; the admin role is enforced here (requireAdmin, with the
 * fresh-principal check). CSRF is checked at the edge for the POSTs.
 *
 *   GET  /api/admin/announcements?page=            → { announcements, total, pageSize }
 *   POST /api/admin/announcements/preview { audience }
 *        → { reach: { students, withPush }, pushConfigured }
 *   POST /api/admin/announcements/send { title, body, link?, audience }
 *        → { announcement }
 *
 * audience: { kind: "students", studentClass: "9"|"10"|"11"|"12"|"dropper"|null,
 *             exam: "jee"|"neet"|null, premiumOnly: boolean } | { kind: "me" }
 * Refusals are { detail, code } with 400 / 409 (double send) / 429 (hourly limit).
 */

// A send to ~1000 students runs inside the request (10 at a time).
export const maxDuration = 300;

type RouteContext = { params: Promise<{ slug?: string[] }> };

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    throw new AnnouncementError(400, "invalid_body", "Invalid JSON body.");
  }
}

async function route(method: string, request: NextRequest, slug: string[], adminId: string): Promise<Response | null> {
  if (method === "GET" && slug.length === 0) {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    return NextResponse.json(await listAnnouncements(Number.isInteger(page) && page > 0 ? page : 1));
  }
  if (method === "POST" && slug.length === 1 && slug[0] === "preview") {
    const body = await readBody(request);
    return NextResponse.json(await previewReach(requireAudience(body.audience), adminId));
  }
  if (method === "POST" && slug.length === 1 && slug[0] === "send") {
    const body = await readBody(request);
    const draft = requireDraft(body);
    const audience = requireAudience(body.audience);
    return NextResponse.json(await sendAnnouncement(adminId, draft, audience));
  }
  return null;
}

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await requireAdmin(request);
    const slug = getSlugSegments(await context.params);
    return (await route(method, request, slug, auth.userId)) ?? NextResponse.json({ detail: "Not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof AnnouncementError) {
      return NextResponse.json({ detail: error.message, code: error.code }, { status: error.status });
    }
    if (error instanceof AuthzError || isAuthServiceUnavailableError(error)) return authzErrorResponse(error);
    console.error("[admin announcements] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

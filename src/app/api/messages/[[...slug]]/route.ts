import { NextResponse, type NextRequest } from "next/server";

import { getSlugSegments, notFound } from "@/server/http";
import { handleMessagesApi } from "@/server/messaging/routes";

/**
 * Student messaging for the website: the same routes and shapes as
 * `/api/mobile/messages*` (contract addendum 02/11/2026), served by the same
 * handler (src/server/messaging/routes.ts).
 *
 * Edge: "/api/messages" is an authenticated prefix (src/server/route-policy.ts);
 * the middleware verifies the cookie session, checks CSRF and the mutation
 * limiter on writes, and refuses everything while the `studentMessaging`
 * kill-switch is on. The handler checks the flags (studentMessaging +
 * studentSocial, else 404) and the student role.
 *
 * Optional catch-all on purpose: `GET /api/messages?box=` (the list) has no
 * segment after "messages". One route file for the whole surface (the Next 16
 * new-route-404 rule, AGENTS.md).
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  const slug = getSlugSegments(await context.params);
  try {
    return (await handleMessagesApi(method, request, ["messages", ...slug])) ?? notFound();
  } catch (error) {
    console.error("[messages] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

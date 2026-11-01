import { NextResponse, type NextRequest } from "next/server";

import { AuthzError, authzErrorResponse, requireAdmin } from "@/server/authz";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { getReport, listReports, resolveReport } from "@/server/messaging/admin";
import { isReportAction, MessagingError, parseSuspendDays, SUSPEND_DAYS_MAX, SUSPEND_DAYS_MIN } from "@/server/messaging/rules";

/**
 * Student messaging — admin review of reports (contract addendum 02/11/2026).
 * One catch-all route file (the Next 16 new-route-404 rule). "/api/admin" is
 * an authenticated prefix; the admin role is enforced here (requireAdmin, with
 * the fresh-principal check). Not behind the studentMessaging flag or its
 * kill-switch, so reports can still be worked while messaging is off.
 *
 *   GET  /api/admin/messaging/reports?status=open|resolved&page=  → { reports, total }
 *   GET  /api/admin/messaging/reports/:id                         → { report, messages, suspendedUntil }
 *   POST /api/admin/messaging/reports/:id/resolve { action: dismiss|warn|suspend, days?: 1..90, note? } → { report }
 *
 * Every resolve writes an audit event (messaging.report.<action>) in the same
 * transaction as the change.
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };

function refusal(error: MessagingError): NextResponse {
  return NextResponse.json({ detail: error.message, code: error.code, ...error.extra }, { status: error.status });
}

async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    throw new MessagingError(400, "invalid_body", "Invalid JSON body.");
  }
}

async function route(method: string, request: NextRequest, slug: string[], adminId: string): Promise<Response | null> {
  const [head, id, action] = slug;
  if (head !== "reports") return null;

  if (method === "GET" && slug.length === 1) {
    const params = request.nextUrl.searchParams;
    const status = params.get("status") === "resolved" ? "resolved" : "open";
    const page = Number(params.get("page") ?? "1");
    return NextResponse.json(await listReports(status, Number.isInteger(page) && page > 0 ? page : 1));
  }
  if (method === "GET" && slug.length === 2) return NextResponse.json(await getReport(id));

  if (method === "POST" && slug.length === 3 && action === "resolve") {
    const body = await readBody(request);
    if (!isReportAction(body.action)) {
      throw new MessagingError(400, "invalid_action", "Choose an action: dismiss, warn or suspend.");
    }
    let days: number | null = null;
    if (body.action === "suspend") {
      days = parseSuspendDays(body.days);
      if (days === null) {
        throw new MessagingError(400, "invalid_days", `Choose how many days to suspend (${SUSPEND_DAYS_MIN} to ${SUSPEND_DAYS_MAX}).`);
      }
    }
    const note = typeof body.note === "string" ? body.note : null;
    return NextResponse.json(await resolveReport(adminId, id, { action: body.action, days, note }));
  }
  return null;
}

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await requireAdmin(request);
    const slug = getSlugSegments(await context.params);
    return (await route(method, request, slug, auth.userId)) ?? NextResponse.json({ detail: "Not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof MessagingError) return refusal(error);
    if (error instanceof AuthzError || isAuthServiceUnavailableError(error)) return authzErrorResponse(error);
    console.error("[admin messaging] request failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ detail: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}

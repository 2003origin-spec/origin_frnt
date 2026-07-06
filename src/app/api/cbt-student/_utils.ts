import { NextResponse, type NextRequest } from "next/server";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { CBT_PARTICIPANT_COOKIE } from "@/lib/cbt/participant-token";
import { resolveParticipantFromToken, type ResolvedParticipant } from "@/server/cbt/cbt-rooms-service";

export function studentJson<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function cbtEnabled(): boolean {
  return isFeatureEnabled("cbtModule");
}

export function notFoundWhenDisabled(): NextResponse {
  return NextResponse.json({ detail: "Not found." }, { status: 404 });
}

export function clientIpOf(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "anonymous";
}

/** Resolves the current student from the participant cookie (or null). */
export async function resolveStudent(request: NextRequest): Promise<ResolvedParticipant | null> {
  const token = request.cookies.get(CBT_PARTICIPANT_COOKIE)?.value;
  return resolveParticipantFromToken(token);
}

/** JSON content-type requirement — defense-in-depth for the CSRF-exempt surface. */
export function requireJsonContentType(request: NextRequest): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

export function handleStudentError(error: unknown): NextResponse {
  const status = (error as { status?: number })?.status ?? 400;
  const message = error instanceof Error ? error.message : "Request failed.";
  return NextResponse.json({ detail: message }, { status });
}

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

/**
 * Errors carry an optional machine-readable `code` (and `rev` for a stale
 * draft) so the player can react precisely — showing the thank-you screen for
 * `already_submitted`, re-syncing on `stale_draft` — instead of parsing prose.
 */
export function handleStudentError(error: unknown): NextResponse {
  const err = error as { status?: number; code?: string; rev?: number };
  // Only an error that CARRIES a status is the student's fault (every
  // validation path sets one). Anything else — a pg timeout at the bell, pool
  // exhaustion, a reset connection, Redis — is ours and transient: answering
  // 400 made the player treat it as a permanent rejection and stop saving.
  if (typeof err?.status !== "number") {
    const transient = isTransientInfraError(error);
    console.error("[cbt-student] unhandled error", error);
    return NextResponse.json(
      { detail: "Something went wrong on our side. Please try again.", code: transient ? "temporarily_unavailable" : "server_error" },
      { status: transient ? 503 : 500 },
    );
  }
  const status = err.status;
  const message = error instanceof Error ? error.message : "Request failed.";
  const body: { detail: string; code?: string; rev?: number } = { detail: message };
  if (typeof err?.code === "string") body.code = err.code;
  if (typeof err?.rev === "number") body.rev = err.rev;
  return NextResponse.json(body, { status });
}

/** Postgres SQLSTATEs that mean "try again", not "you sent something wrong". */
const TRANSIENT_PG_CODES = new Set(["57014", "57P01", "57P02", "57P03", "53300", "53400", "40001", "40P01"]);

/** A DB timeout / connection / overload error: answered 503 so clients retry. */
export function isTransientInfraError(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string" && (TRANSIENT_PG_CODES.has(code) || code.startsWith("08"))) return true;
  if (typeof code === "string" && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code)) return true;
  const message = error instanceof Error ? error.message : "";
  return /timeout|timed out|Connection terminated|too many clients|ECONNRESET|ECONNREFUSED/i.test(message);
}

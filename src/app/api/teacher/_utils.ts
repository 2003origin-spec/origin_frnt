import { NextResponse, type NextRequest } from "next/server";

import { AuthzError, authzErrorResponse } from "@/server/authz";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { FeatureDisabledError } from "@/lib/feature-flags";

export type WorkspaceIdRouteContext = {
  params: Promise<{ workspaceId: string }>;
};

export async function getWorkspaceId(context: WorkspaceIdRouteContext): Promise<string> {
  const { workspaceId } = await context.params;
  return workspaceId;
}

export function teacherJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function handleTeacherError(error: unknown): NextResponse {
  if (error instanceof FeatureDisabledError) {
    return NextResponse.json({ detail: error.message }, { status: 404 });
  }
  // The per-request principal check in requireRole throws
  // AuthServiceUnavailableError on a DB hiccup — that is a 503, never the
  // generic 400 below (clients would otherwise treat an outage as a bad request).
  if (error instanceof AuthzError || isAuthServiceUnavailableError(error)) {
    return authzErrorResponse(error) as NextResponse;
  }
  if (error instanceof Error) {
    const status = (error as { status?: number }).status ?? 400;
    // A machine-readable refusal code (e.g. the test lifecycle guards'
    // `test_has_attempts`) rides along only on errors that set a status
    // deliberately — a pg error's SQLSTATE `code` is never exposed.
    const code = (error as { code?: unknown }).code;
    const body =
      typeof (error as { status?: unknown }).status === "number" && typeof code === "string"
        ? { detail: error.message, code }
        : { detail: error.message };
    return NextResponse.json(body, { status });
  }
  console.error("[teacher api] unexpected error", error);
  return NextResponse.json({ detail: "Internal server error." }, { status: 500 });
}

export function requestIdOf(request: NextRequest): string | null {
  return request.headers.get("x-request-id");
}

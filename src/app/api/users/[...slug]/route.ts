import type { NextRequest } from "next/server";

import { badRequest, getSlugSegments, methodNotAllowed, parseJsonBody } from "@/server/http";
import { handleUsersRequest } from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

async function dispatch(method: string, request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  let payload: Record<string, unknown> = {};
  if (method !== "GET" && method !== "DELETE") {
    try {
      payload = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      return badRequest("Invalid JSON body.");
    }
  }
  return handleUsersRequest(method, slug, request, payload);
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

export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}

export async function DELETE() {
  return methodNotAllowed();
}

import type { NextRequest } from "next/server";

import { requireUserFromRequest } from "@/server/auth";
import {
  addSessionMessage,
  createDoubtSession,
  deleteDoubtSession,
  getDoubtSession,
  listDoubtSessions,
  updateDoubtSession,
} from "@/server/interaction";
import {
  badRequest,
  created,
  getSlugSegments,
  noContent,
  notFound,
  ok,
  parseJsonBody,
  unauthorized,
} from "@/server/http";
import { readStore, withStore, writeStore } from "@/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug?: string[] }>;
};

async function resolveSlug(context: RouteContext): Promise<string[]> {
  const params = await context.params;
  return getSlugSegments(params);
}

function validateBaseRoute(slug: string[]) {
  if (slug.length === 0 || slug[0] !== "doubts") {
    return false;
  }
  return true;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug)) {
    return notFound();
  }

  const store = readStore();
  const user = requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }

  if (slug.length === 1) {
    return ok(listDoubtSessions(store, user.id));
  }

  if (slug.length === 2) {
    const session = getDoubtSession(store, user.id, slug[1]);
    if (!session) {
      return notFound("Doubt session not found.");
    }
    return ok(session);
  }

  return notFound();
}

export async function POST(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug)) {
    return notFound();
  }

  try {
    if (slug.length === 1) {
      const payload = await parseJsonBody<{ title?: string; subject?: string }>(request);
      const result = withStore((store) => {
        const user = requireUserFromRequest(store, request);
        if (!user) {
          return { status: "unauthorized" as const };
        }
        const session = createDoubtSession(store, user.id, payload);
        return { status: "created" as const, session };
      });

      if (result.status === "unauthorized") {
        return unauthorized();
      }
      return created(result.session);
    }

    if (slug.length === 3 && slug[2] === "add_message") {
      const payload = await parseJsonBody<{ content?: string; image?: string }>(request);
      const store = readStore();
      const user = requireUserFromRequest(store, request);
      if (!user) {
        return unauthorized();
      }
      const reply = await addSessionMessage(store, user, slug[1], payload);
      if (!reply) {
        return notFound("Doubt session not found.");
      }
      if ("error" in reply && typeof reply.error === "string") {
        return badRequest(reply.error, { error: reply.error });
      }
      writeStore(store);

      return created(reply);
    }
  } catch {
    return badRequest("Invalid JSON payload.");
  }

  return notFound();
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug) || slug.length !== 2) {
    return notFound();
  }

  try {
    const payload = await parseJsonBody<{ title?: string; subject?: string }>(request);
    const result = withStore((store) => {
      const user = requireUserFromRequest(store, request);
      if (!user) {
        return { status: "unauthorized" as const };
      }
      const session = updateDoubtSession(store, user.id, slug[1], payload);
      if (!session) {
        return { status: "not_found" as const };
      }
      return { status: "ok" as const, session };
    });

    if (result.status === "unauthorized") {
      return unauthorized();
    }
    if (result.status === "not_found") {
      return notFound("Doubt session not found.");
    }
    return ok(result.session);
  } catch {
    return badRequest("Invalid JSON payload.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const slug = await resolveSlug(context);
  if (!validateBaseRoute(slug) || slug.length !== 2) {
    return notFound();
  }

  const result = withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return { status: "unauthorized" as const };
    }
    const removed = deleteDoubtSession(store, user.id, slug[1]);
    return { status: removed ? ("deleted" as const) : ("not_found" as const) };
  });

  if (result.status === "unauthorized") {
    return unauthorized();
  }
  if (result.status === "not_found") {
    return notFound("Doubt session not found.");
  }
  return noContent();
}

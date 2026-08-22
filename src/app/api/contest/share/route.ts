/**
 * POST   /api/contest/share  body { contestId }  — mint (opt-in) the caller's
 *        public share slug for a published result. Idempotent.
 * DELETE /api/contest/share?contestId=            — revoke it.
 *
 * Authenticated (the caller can only share/revoke their OWN result). Gated by the
 * `contest` flag. The public read is a separate unauthenticated route.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { getOrCreateShareSlug, revokeShareSlug } from "@/server/contest/contest-share-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const ShareSchema = z.object({ contestId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = ShareSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const slug = await getOrCreateShareSlug(parsed.data.contestId, ctx.userId);
    return teacherJson({ slug });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    await revokeShareSlug(contestId, ctx.userId);
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * GET /api/public/contest-share/[slug]  — UNAUTHENTICATED sanitized read of a
 * shared contest result. Returns { card } or 404 (unknown / revoked / not
 * published). Never exposes answers/email/full name/user id. Public by design
 * (declared in route-policy PUBLIC_API_PREFIXES).
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getPublicShareCard } from "@/server/contest/contest-share-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const { slug } = await context.params;
    const card = await getPublicShareCard(slug);
    if (!card) return teacherJson({ detail: "Not found." }, { status: 404 });
    // Short shared cache — the link is public + immutable-ish, but revocable.
    return teacherJson({ card }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
  } catch (error) {
    return handleTeacherError(error);
  }
}

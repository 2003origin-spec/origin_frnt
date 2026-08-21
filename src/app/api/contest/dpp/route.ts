/**
 * GET /api/contest/dpp?contestId=  — the custom DPP built from the caller's
 * contest mistakes. Returns { locked, reason } when the registration/premium/
 * published gate isn't met (so the UI can show "Subscribe to unlock"), else the
 * fresh weak-chapter practice set. Plan Phase 8c.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getContestMistakeDpp } from "@/server/contest/contest-dpp-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const dpp = await getContestMistakeDpp(contestId, ctx.userId);
    return teacherJson({ dpp });
  } catch (error) {
    return handleTeacherError(error);
  }
}

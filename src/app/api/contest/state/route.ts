/**
 * GET /api/contest/state?contestId=  — current attempt state + server clock for
 * the skew-corrected countdown and the resume decision. Read-only. Plan Phase 3.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getAttemptState } from "@/server/contest/contest-attempt-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const state = await getAttemptState(contestId, ctx.userId);
    return teacherJson({ state });
  } catch (error) {
    return handleTeacherError(error);
  }
}

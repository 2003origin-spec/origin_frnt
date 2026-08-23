/**
 * GET /api/contest/attempt-review?contestId=  — the caller's post-contest
 * solutions review (their answer vs correct + explanation). Gated in the service
 * on results-published + own finished attempt. Authenticated + `contest` flag.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getAttemptReview } from "@/server/contest/contest-attempt-review-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const review = await getAttemptReview(contestId, ctx.userId);
    return teacherJson(review);
  } catch (error) {
    return handleTeacherError(error);
  }
}

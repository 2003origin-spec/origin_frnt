/**
 * GET /api/contest/friends-leaderboard?contestId=…
 *
 * The contest leaderboard filtered to people the user follows (+ themselves).
 * Authenticated (student-only) prefix; user id from the session.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getFriendsLeaderboard } from "@/server/contest/contest-ranking-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const rows = await getFriendsLeaderboard(contestId, ctx.userId);
    return teacherJson({ rows });
  } catch (error) {
    return handleTeacherError(error);
  }
}

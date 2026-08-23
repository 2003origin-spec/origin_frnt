/**
 * GET /api/contest/orbit-leaderboard?cursor=  — the global all-time ORBIT
 * ranking (keyset-paged). Authenticated + `contest` flag. Read-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getOrbitLeaderboard } from "@/server/contest/contest-profile-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireAuth(request);
    const cursorRaw = new URL(request.url).searchParams.get("cursor");
    const cursor = cursorRaw != null ? Number(cursorRaw) : null;
    const page = await getOrbitLeaderboard({ cursor: Number.isFinite(cursor) ? cursor : null, limit: 50 });
    return teacherJson(page);
  } catch (error) {
    return handleTeacherError(error);
  }
}

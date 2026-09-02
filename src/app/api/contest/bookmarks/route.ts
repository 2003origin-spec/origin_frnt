/**
 * GET  /api/contest/bookmarks?contestId=…  — positions the user bookmarked
 * POST /api/contest/bookmarks               — toggle a bookmark { contestId, position }
 *
 * Student-owned contest question bookmarks. `/api/contest` is an authenticated
 * (student-only) prefix; the user id comes from the session, never the body.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { listBookmarkedPositions, toggleContestBookmark } from "@/server/contest/contest-bookmark-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const positions = await listBookmarkedPositions(ctx.userId, contestId);
    return teacherJson({ positions });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const ToggleSchema = z.object({ contestId: z.string().min(1), position: z.number().int().min(0) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = ToggleSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const result = await toggleContestBookmark({ userId: ctx.userId, contestId: parsed.data.contestId, position: parsed.data.position });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

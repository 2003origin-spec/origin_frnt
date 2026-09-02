/**
 * GET  /api/contest/teams?contestId=…          — my team + team leaderboard
 * POST /api/contest/teams
 *   { contestId, action: 'create', name }        — create a team
 *   { contestId, action: 'join', joinCode }      — join a team by code
 *
 * Team contests. Authenticated student prefix; user id from the session.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { createTeam, getMyTeam, getTeamLeaderboard, joinTeam } from "@/server/contest/contest-team-service";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });
    const [myTeam, leaderboard] = await Promise.all([getMyTeam(contestId, ctx.userId), getTeamLeaderboard(contestId)]);
    return teacherJson({ myTeam, leaderboard });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const Schema = z.union([
  z.object({ contestId: z.string().min(1), action: z.literal("create"), name: z.string().min(1).max(60) }),
  z.object({ contestId: z.string().min(1), action: z.literal("join"), joinCode: z.string().min(1).max(16) }),
]);

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const team = parsed.data.action === "create"
      ? await createTeam({ contestId: parsed.data.contestId, userId: ctx.userId, name: parsed.data.name })
      : await joinTeam({ contestId: parsed.data.contestId, userId: ctx.userId, joinCode: parsed.data.joinCode });
    return teacherJson({ team }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

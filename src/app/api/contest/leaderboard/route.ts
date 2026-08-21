/**
 * GET /api/contest/leaderboard?contestId=&cursor=&limit=  — the published
 * global leaderboard, keyset-paged by rank. HARD-gated on result_published.
 * Plan Phase 6.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getUserPostgresReplicaPool } from "@/server/user-postgres";
import { getLeaderboardPage } from "@/server/contest/contest-ranking-service";
import { ensureContestSchema } from "@/server/contest/contest-schema";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireAuth(request);
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });

    await ensureContestSchema();
    const pool = getUserPostgresReplicaPool();
    if (!pool) return teacherJson({ detail: "Unavailable." }, { status: 503 });
    const contest = await pool.query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
    if (!contest.rows[0]) return teacherJson({ detail: "Contest not found." }, { status: 404 });
    if (contest.rows[0].status !== "result_published" && contest.rows[0].status !== "archived") {
      return teacherJson({ detail: "The leaderboard is not published yet." }, { status: 403 });
    }

    const cursor = Number(url.searchParams.get("cursor")) || 0;
    const limit = Number(url.searchParams.get("limit")) || 50;
    const page = await getLeaderboardPage(contestId, cursor, limit);
    return teacherJson(page);
  } catch (error) {
    return handleTeacherError(error);
  }
}

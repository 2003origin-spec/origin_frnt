// audit-skip: read-only analytics aggregation — reads contest.* funnel/retention,
// writes nothing.
/**
 * GET /api/admin/contest/analytics — per-contest funnel (registered → played →
 * submitted) + week-over-week return cohorts. Admin-only + `contest` flag.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getContestAnalytics } from "@/server/contest/contest-analytics-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const analytics = await getContestAnalytics();
    return teacherJson(analytics);
  } catch (error) {
    return handleTeacherError(error);
  }
}

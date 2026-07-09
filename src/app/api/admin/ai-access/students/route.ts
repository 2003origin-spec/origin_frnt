/**
 * GET /api/admin/ai-access/students?tier=free|premium&query=&limit=50&offset=0 —
 * the Free / Premium tier browsers: students with override + effective decision.
 * See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.5.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getStudentsOverview } from "@/server/ai-access-service";

import { intParam, requireAiAccessAdmin } from "../_util";

export async function GET(request: NextRequest) {
  try {
    await requireAiAccessAdmin(request);
    const sp = request.nextUrl.searchParams;
    const tier = sp.get("tier") === "premium" ? "premium" : "free";
    return teacherJson(
      await getStudentsOverview({
        tier,
        query: sp.get("query") ?? undefined,
        limit: intParam(sp.get("limit"), 50, 1, 100),
        offset: intParam(sp.get("offset"), 0, 0, 1_000_000),
      }),
    );
  } catch (error) {
    return handleTeacherError(error);
  }
}

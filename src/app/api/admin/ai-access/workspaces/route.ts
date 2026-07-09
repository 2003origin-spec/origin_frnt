/**
 * GET /api/admin/ai-access/workspaces?query=&limit=25&offset=0 — institutes/
 * teacher spaces with ≥1 enrollment or type 'institute', batches nested, each
 * with its rule value. See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.3.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getWorkspacesOverview } from "@/server/ai-access-service";

import { intParam, requireAiAccessAdmin } from "../_util";

export async function GET(request: NextRequest) {
  try {
    await requireAiAccessAdmin(request);
    const sp = request.nextUrl.searchParams;
    return teacherJson(
      await getWorkspacesOverview({
        query: sp.get("query") ?? undefined,
        limit: intParam(sp.get("limit"), 25, 1, 100),
        offset: intParam(sp.get("offset"), 0, 0, 1_000_000),
      }),
    );
  } catch (error) {
    return handleTeacherError(error);
  }
}

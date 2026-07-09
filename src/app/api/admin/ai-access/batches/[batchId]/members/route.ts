/**
 * GET /api/admin/ai-access/batches/[batchId]/members?query=&limit=50&offset=0 —
 * a batch's active members with each student's override + effective decision
 * (resolveAiAccessBulk, one SQL for the page).
 * See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.4.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getBatchMembersOverview } from "@/server/ai-access-service";

import { intParam, requireAiAccessAdmin } from "../../../_util";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> },
) {
  try {
    await requireAiAccessAdmin(request);
    const { batchId } = await context.params;
    const sp = request.nextUrl.searchParams;
    return teacherJson(
      await getBatchMembersOverview({
        batchId,
        query: sp.get("query") ?? undefined,
        limit: intParam(sp.get("limit"), 50, 1, 100),
        offset: intParam(sp.get("offset"), 0, 0, 1_000_000),
      }),
    );
  } catch (error) {
    return handleTeacherError(error);
  }
}

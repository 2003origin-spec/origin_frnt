/**
 * GET /api/admin/ai-access — console overview (global + tiers + counts +
 * student counts + orphan rules). Admin-only, gated by adminControlCenter +
 * aiAccessControls. See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.1.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getAiAccessOverview } from "@/server/ai-access-service";

import { requireAiAccessAdmin } from "./_util";

export async function GET(request: NextRequest) {
  try {
    await requireAiAccessAdmin(request);
    return teacherJson(await getAiAccessOverview());
  } catch (error) {
    return handleTeacherError(error);
  }
}

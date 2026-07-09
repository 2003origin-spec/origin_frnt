/**
 * GET /api/admin/ai-access/users/[userId] — the "why" panel: the student's
 * effective decision + the full precedence chain (each level with its value),
 * so support can read exactly why a student is on/off.
 * See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.6.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getUserWhyChain } from "@/server/ai-access-service";

import { requireAiAccessAdmin } from "../../_util";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAiAccessAdmin(request);
    const { userId } = await context.params;
    return teacherJson(await getUserWhyChain(userId));
  } catch (error) {
    return handleTeacherError(error);
  }
}

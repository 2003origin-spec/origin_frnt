/**
 * GET /api/admin/premium-access — console overview: student plan counts (free /
 * paid / comp / teacher) + the current Event Mode state. Admin-only, gated by
 * adminControlCenter + adminPremiumAccess.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { getPremiumAccessOverview } from "@/server/premium-access-admin-service";

import { requirePremiumAccessAdmin } from "./_util";

export async function GET(request: NextRequest) {
  try {
    await requirePremiumAccessAdmin(request);
    return teacherJson(await getPremiumAccessOverview());
  } catch (error) {
    return handleTeacherError(error);
  }
}

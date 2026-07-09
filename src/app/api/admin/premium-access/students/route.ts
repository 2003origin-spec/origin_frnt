/**
 * GET /api/admin/premium-access/students?plan=free|paid|comp|teacher|premium|all
 *   &query=&limit=50&offset=0 — the student roster with a derived plan label
 * (paid > comp > teacher > free). Admin-only.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { listStudentsByPlan, type PlanFilter } from "@/server/premium-access-admin-store";

import { intParam, requirePremiumAccessAdmin } from "../_util";

const PLANS: PlanFilter[] = ["free", "paid", "comp", "teacher", "premium", "all"];

export async function GET(request: NextRequest) {
  try {
    await requirePremiumAccessAdmin(request);
    const sp = request.nextUrl.searchParams;
    const planParam = sp.get("plan");
    const plan: PlanFilter = PLANS.includes(planParam as PlanFilter) ? (planParam as PlanFilter) : "free";
    return teacherJson(
      await listStudentsByPlan({
        plan,
        query: sp.get("query") ?? undefined,
        limit: intParam(sp.get("limit"), 50, 1, 100),
        offset: intParam(sp.get("offset"), 0, 0, 1_000_000),
      }),
    );
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * GET  /api/admin/premium-access/subjects?userId=X — per-subject ownership
 *   breakdown (paid / teacher_code / admin_comp) for one student.
 * POST /api/admin/premium-access/subjects — sets that student's admin_comp
 *   subjects to exactly the given list (grants what's missing, revokes what's
 *   no longer wanted). Paid and teacher_code rows are never touched. Lets an
 *   admin comp individual subjects instead of only the full 4-subject bundle —
 *   including a student who already owns one subject via a teacher_code grant.
 * Admin-only; CSRF at the edge.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody, badRequest } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import {
  getStudentSubjectAccess,
  updateStudentSubjectComp,
} from "@/server/premium-access-admin-service";
import { ALL_SUBJECTS } from "@/lib/entitlements";

import { requirePremiumAccessAdmin } from "../_util";

const Schema = z.object({
  userId: z.string().min(1),
  subjects: z.array(z.enum(ALL_SUBJECTS as [string, ...string[]])).max(ALL_SUBJECTS.length),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePremiumAccessAdmin(request);
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) return badRequest("userId is required");
    return teacherJson({ subjects: await getStudentSubjectAccess(userId) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePremiumAccessAdmin(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const result = await updateStudentSubjectComp({
      actorUserId: actor.userId,
      userId: parsed.data.userId,
      subjects: parsed.data.subjects as (typeof ALL_SUBJECTS)[number][],
      expiresAt: parsed.data.expiresAt ?? null,
    });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

// audit-skip: student self-registration — writes only the caller's own
// registration row (no admin/state mutation; audit trail is the row itself).
/**
 * POST /api/contest/register  body: { contestId }  — student registers for a
 * contest. Idempotent; window-checked server-side against DB NOW() (fail-closed).
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1/2.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { registerForContest } from "@/server/contest/contest-registration-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const RegisterSchema = z.object({ contestId: z.string().min(1), code: z.string().max(64).optional() });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = RegisterSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const result = await registerForContest(parsed.data.contestId, ctx.userId, { code: parsed.data.code });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

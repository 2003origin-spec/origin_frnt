import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import {
  checkFailureBudget,
  checkRateLimit,
  generalLimiter,
  recordFailure,
} from "@/lib/rate-limit";
import { codeCheckFailureKeys } from "@/server/workspaces/join-code-guard";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkCodeAvailability } from "@/server/workspaces/codes";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const schema = z.object({ rawDisplay: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("orgCodes");
    // Teacher/admin only: "already in use" is an existence oracle for student
    // join codes, and only the teacher onboarding form needs it.
    const auth = await requireRole(request, ["teacher", "admin"]);
    const limited = await checkRateLimit(generalLimiter, `code-check:${auth.userId}`);
    if (limited) return limited;
    const failureKeys = codeCheckFailureKeys(auth.userId, request);
    const exhausted = await checkFailureBudget(failureKeys);
    if (exhausted) return exhausted;
    const body = await parseJsonBody(request);
    const { rawDisplay } = schema.parse(body);
    const result = await checkCodeAvailability(rawDisplay);
    // A miss for a guesser is "available" with a well-formed code (the lookup
    // ran and found nothing); format errors never touch the code table.
    if (result.available) await recordFailure(failureKeys);
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

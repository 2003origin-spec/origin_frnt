import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import {
  checkRateLimit,
  generalLimiter,
  recordFailure,
} from "@/lib/rate-limit";
import { checkJoinCodeBudget, isJoinCodeMiss, joinCodeFailureKeys } from "@/server/workspaces/join-code-guard";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { joinByCode, JoinCodeError } from "@/server/workspaces/join";

import { handleTeacherError, requestIdOf, teacherJson } from "../../teacher/_utils";

const schema = z.object({ code: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("enrollment");
    const auth = await requireAuth(request);
    if (auth.role !== "student") {
      return teacherJson(
        { detail: "Only students can join workspaces with a code." },
        { status: 403 },
      );
    }
    const limited = await checkRateLimit(generalLimiter, `join-code:${auth.userId}`);
    if (limited) return limited;
    const failureKeys = joinCodeFailureKeys(auth.userId, request);
    const exhausted = await checkJoinCodeBudget(failureKeys);
    if (exhausted) return exhausted;
    const body = await parseJsonBody(request);
    const { code } = schema.parse(body);
    let result;
    try {
      result = await joinByCode({
        studentId: auth.userId,
        rawCode: code,
        requestId: requestIdOf(request),
      });
    } catch (error) {
      if (isJoinCodeMiss(error)) {
        // Past the (per-IP) budget this WRONG code gets 429 (and the user is now gated).
        const overBudget = await recordFailure(failureKeys.charge);
        if (overBudget) return overBudget;
      }
      throw error;
    }
    return teacherJson(result, { status: result.isNew ? 201 : 200 });
  } catch (error) {
    if (error instanceof JoinCodeError) {
      return teacherJson({ detail: error.message }, { status: error.status });
    }
    return handleTeacherError(error);
  }
}

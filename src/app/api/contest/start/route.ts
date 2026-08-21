// audit-skip: student starts/resumes their OWN attempt (own-row runtime state,
// no admin/config mutation; the attempt row itself is the record).
/**
 * POST /api/contest/start  body: { contestId }  — start or resume the rated
 * attempt. Registration + LIVE gated server-side (fail-closed). Idempotent:
 * calling again after start resumes. Plan Phase 3.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { startAttempt } from "@/server/contest/contest-attempt-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const StartSchema = z.object({ contestId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = StartSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const state = await startAttempt(parsed.data.contestId, ctx.userId, ctx.sessionId);
    return teacherJson({ state });
  } catch (error) {
    return handleTeacherError(error);
  }
}

// audit-skip: read-only paper preview — resolves questions from the OGCode bank
// and returns them for review; writes nothing (freeze happens at /publish).
/**
 * POST /api/admin/contest/[id]/questions/resolve
 *
 * Resolve an admin per-subject/topic selection into the concrete frozen question
 * set (a dry-run PREVIEW of the paper) + shortfall detection: rejects (naming the
 * subject) when the OGCode pool can't fill a requested count. The returned
 * `questions` array is exactly what POST .../publish expects, so the admin flow
 * is: resolve (preview) → review → publish.
 *
 * Admin-only + `contest` flag. Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { resolveContestQuestions } from "@/server/contest/contest-question-selection";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const ResolveSchema = z.object({
  selections: z
    .array(
      z.object({
        subject: z.string().min(1),
        count: z.number().int().min(1).max(500),
        topics: z.array(z.string()).optional(),
        difficulties: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = ResolveSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const questions = await resolveContestQuestions({ contestId: id, selections: parsed.data.selections });
    return teacherJson({ questions, count: questions.length });
  } catch (error) {
    return handleTeacherError(error);
  }
}

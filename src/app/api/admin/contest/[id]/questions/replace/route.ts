// audit-skip: read-only paper-preview edit — resolves ONE replacement question
// from the OGCode bank for the admin builder; writes nothing (freeze at /publish).
/**
 * POST /api/admin/contest/[id]/questions/replace
 *
 * Resolve a single fresh replacement question for a subject/topic, excluding the
 * ids already in the preview paper (so the swap is never a duplicate). Returns
 * the same shape as one element of /questions/resolve. Admin-only + `contest`
 * flag. Plan: admin builder curation.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { resolveOneReplacement } from "@/server/contest/contest-question-selection";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const ReplaceSchema = z.object({
  subject: z.string().min(1),
  topics: z.array(z.string()).optional(),
  difficulties: z.array(z.string()).optional(),
  excludeIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = ReplaceSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const question = await resolveOneReplacement({
      contestId: id,
      subject: parsed.data.subject,
      topics: parsed.data.topics,
      difficulties: parsed.data.difficulties,
      excludeIds: parsed.data.excludeIds ?? [],
    });
    return teacherJson({ question });
  } catch (error) {
    return handleTeacherError(error);
  }
}

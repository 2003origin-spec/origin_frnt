/**
 * POST /api/admin/contest/manual-question
 * Author a single MCQ directly into the contest question pool. Admin + contest flag.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { createManualContestQuestion } from "@/server/contest/contest-import-service";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const Schema = z.object({
  text: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correctOption: z.number().int().min(0),
  subject: z.string().min(1),
  chapter: z.string().min(1),
  difficulty: z.string().optional(),
  explanation: z.string().optional(),
  practiceEligible: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const result = await createManualContestQuestion(ctx.userId, parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId, workspaceId: null, entityType: "contest", entityId: result.catalogId,
      action: "contest.manual_question_created", after: { subject: parsed.data.subject, chapter: parsed.data.chapter },
    });
    return teacherJson(result, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * POST /api/admin/contest/[id]/publish  — publish a draft contest.
 *
 * Validates the schedule + anti-guessing scoring guardrail, freezes the supplied
 * question set into contest.contest_questions (immutable), stamps duration, and
 * flips status draft → scheduled (atomic, in the service).
 *
 * The body carries the RESOLVED question set to freeze. (A later increment wires
 * OGCode selection + shortfall detection so the admin picks by subject/topic and
 * the server resolves + validates the pool before this call.)
 *
 * Admin-only + `contest` flag. Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { publishContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const QuestionSchema = z.object({
  questionId: z.string().min(1),
  subject: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  snapshot: z.record(z.string(), z.unknown()),
  marks: z.number().nullable().optional(),
  negativeMarks: z.number().nullable().optional(),
});

const PublishSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = PublishSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const contest = await publishContest(id, parsed.data.questions);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.published",
      after: { status: contest.status, questionCount: parsed.data.questions.length },
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}

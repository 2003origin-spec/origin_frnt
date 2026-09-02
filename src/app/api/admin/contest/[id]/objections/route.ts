/**
 * GET  /api/admin/contest/[id]/objections            — list objections
 * POST /api/admin/contest/[id]/objections
 *   { objectionId, action: 'accept'|'reject', newCorrectOption? } — resolve + re-grade
 * Admin + contest flag.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { listKeyObjections, resolveKeyObjection } from "@/server/contest/contest-objection-service";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await params;
    return teacherJson({ objections: await listKeyObjections(id) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const Schema = z.object({
  objectionId: z.string().min(1),
  action: z.enum(["accept", "reject"]),
  newCorrectOption: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await params;
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const result = await resolveKeyObjection({ ...parsed.data, adminId: ctx.userId });
    await recordAuditEvent({
      actorUserId: ctx.userId, workspaceId: null, entityType: "contest", entityId: id,
      action: `contest.objection_${parsed.data.action}`, after: { objectionId: parsed.data.objectionId, ...result },
    });
    return teacherJson({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

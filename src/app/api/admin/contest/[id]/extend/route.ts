/**
 * POST /api/admin/contest/[id]/extend  body: { addMinutes }
 *
 * Incident control — atomically extend a live/scheduled contest's deadline for
 * everyone. Admin-only + `contest` flag. See extendContest for the safety model.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { extendContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const ExtendSchema = z.object({ addMinutes: z.number().int().min(1).max(180) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = ExtendSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const contest = await extendContest(id, parsed.data.addMinutes);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.extended",
      after: { addMinutes: parsed.data.addMinutes, endAt: contest.endAt },
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}

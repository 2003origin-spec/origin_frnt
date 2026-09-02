/**
 * GET  /api/admin/contest/[id]/access-codes           — list codes
 * POST /api/admin/contest/[id]/access-codes { count }  — generate N codes
 *
 * Per-contest single-use access codes (access_mode = 'code'). Admin + contest flag.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { generateAccessCodes, listAccessCodes } from "@/server/contest/contest-access-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await params;
    const codes = await listAccessCodes(id);
    return teacherJson({ codes });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const GenSchema = z.object({ count: z.number().int().min(1).max(500) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await params;
    const parsed = GenSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const codes = await generateAccessCodes(id, parsed.data.count);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: id,
      action: "contest.access_codes_generated",
      after: { count: codes.length },
    });
    return teacherJson({ codes }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

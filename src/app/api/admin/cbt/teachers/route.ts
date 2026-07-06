/**
 * GET    /api/admin/cbt/teachers  — list CBT teachers + usage stats
 * POST   /api/admin/cbt/teachers  — add/re-activate a teacher   body: { email, displayName? }
 * DELETE /api/admin/cbt/teachers  — disable a teacher + revoke  body: { id? | email? }
 *
 * Rides the existing authenticated /api/admin prefix; admin-only in-handler.
 * Dark behind cbtModule. Every mutation is audited.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import {
  addCbtTeacher,
  getCbtUsageStats,
  listCbtTeachers,
  removeCbtTeacher,
} from "@/server/cbt/cbt-teachers-service";

const addSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().max(120).nullable().optional(),
});

const removeSchema = z
  .object({
    id: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => Boolean(d.id) || Boolean(d.email), {
    message: "An id or email is required.",
  });

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtModule");
    await requireRole(request, ["admin"]);
    const [teachers, stats] = await Promise.all([listCbtTeachers(), getCbtUsageStats()]);
    return teacherJson({ teachers, stats });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtModule");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = addSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const teacher = await addCbtTeacher({
      email: parsed.data.email,
      displayName: parsed.data.displayName ?? null,
      adminUserId: ctx.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_teacher",
      entityId: teacher.id,
      action: "admin.cbt_teacher_added",
      after: { email: teacher.email, status: teacher.status },
      requestId: requestIdOf(request),
    });
    return teacherJson({ teacher });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtModule");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = removeSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }
    const teacher = await removeCbtTeacher({ id: parsed.data.id, email: parsed.data.email });
    if (!teacher) {
      return teacherJson({ detail: "CBT teacher not found." }, { status: 404 });
    }
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_teacher",
      entityId: teacher.id,
      action: "admin.cbt_teacher_removed",
      before: { email: teacher.email },
      after: { status: teacher.status },
      requestId: requestIdOf(request),
    });
    return teacherJson({ teacher });
  } catch (error) {
    return handleTeacherError(error);
  }
}

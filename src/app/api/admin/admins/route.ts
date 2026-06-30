/**
 * GET    /api/admin/admins        — list all admins (main-admin only)
 * POST   /api/admin/admins        — create a sub-admin {name, email}
 * DELETE /api/admin/admins?id=…   — unassign / delete a sub-admin
 *
 * MAIN-ADMIN only (requireMainAdmin). Gated by adminSubAdmins. This is the one
 * admin surface sub-admins cannot use; every other admin tool is open to all admins.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { createSubAdmin, deleteSubAdmin, listAdmins, requireMainAdmin } from "@/server/admin/admins-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminSubAdmins");
    await requireMainAdmin(request);
    return teacherJson({ admins: await listAdmins() });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("adminSubAdmins");
    const ctx = await requireMainAdmin(request);
    const parsed = CreateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const admin = await createSubAdmin(parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "admin_account",
      entityId: admin.id,
      action: "admin.sub_admin_created",
      after: { id: admin.id, email: admin.email, name: admin.name },
    });
    return teacherJson(admin, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireFeatureEnabled("adminSubAdmins");
    const ctx = await requireMainAdmin(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return teacherJson({ detail: "Missing admin id." }, { status: 400 });
    await deleteSubAdmin(id);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "admin_account",
      entityId: id,
      action: "admin.sub_admin_removed",
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

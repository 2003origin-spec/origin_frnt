/**
 * POST /api/admin/users/[userId]/status
 *   { action: "revoke" | "unrevoke" | "delete", reason? }
 * Admin-only, gated by adminControlCenter + adminUserLifecycle. Guardrails
 * (self / main-admin / admin targets) enforced in the service.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import {
  adminDeleteUser,
  revokeUser,
  unrevokeUser,
} from "@/server/admin/user-lifecycle-service";

import { requireUserLifecycleAdmin } from "../../_util";

type RouteContext = { params: Promise<{ userId: string }> };

const bodySchema = z.object({
  action: z.enum(["revoke", "unrevoke", "delete"]),
  reason: z.string().max(1000).optional().nullable(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const admin = await requireUserLifecycleAdmin(request);
    const { userId } = await context.params;
    const parsed = bodySchema.parse(await parseJsonBody(request));

    if (parsed.action === "revoke") {
      await revokeUser({ actorId: admin.userId, userId, reason: parsed.reason ?? null });
      return teacherJson({ ok: true, status: "revoked" });
    }
    if (parsed.action === "unrevoke") {
      await unrevokeUser({ actorId: admin.userId, userId });
      return teacherJson({ ok: true, status: "active" });
    }
    const result = await adminDeleteUser({ actorId: admin.userId, userId, reason: parsed.reason ?? null });
    return teacherJson({ ok: true, status: "deleted", warnings: result.warnings });
  } catch (error) {
    return handleTeacherError(error);
  }
}

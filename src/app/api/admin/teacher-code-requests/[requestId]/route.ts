/**
 * POST /api/admin/teacher-code-requests/[requestId]
 *   { action: "approve", grantedQuota, aiAccess?, note? }  → approves + issues code
 *   { action: "reject", note? }                             → rejects
 * Admin-only, gated by adminControlCenter + teacherCodeApproval.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import {
  approveCodeRequest,
  rejectCodeRequest,
} from "@/server/workspaces/code-access-admin-service";

import { requireTeacherCodeAdmin } from "../_util";

type RouteContext = { params: Promise<{ requestId: string }> };

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    grantedQuota: z.number().int().positive().max(1_000_000),
    aiAccess: z.boolean().optional(),
    note: z.string().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal("reject"),
    note: z.string().max(1000).optional().nullable(),
  }),
]);

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const admin = await requireTeacherCodeAdmin(request);
    const { requestId } = await context.params;
    const parsed = bodySchema.parse(await parseJsonBody(request));

    if (parsed.action === "approve") {
      const result = await approveCodeRequest({
        actorUserId: admin.userId,
        requestId,
        grantedQuota: parsed.grantedQuota,
        aiAccess: parsed.aiAccess,
        note: parsed.note ?? null,
        requestIdHeader: requestIdOf(request),
      });
      return teacherJson({
        ok: true,
        quota: result.quota,
        aiAccess: result.aiAccess,
        displayCode: result.code.displayCode,
        warning: result.warning,
      });
    }

    await rejectCodeRequest({
      actorUserId: admin.userId,
      requestId,
      note: parsed.note ?? null,
      requestIdHeader: requestIdOf(request),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

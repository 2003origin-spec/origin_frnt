/**
 * GET  /api/cbt/quota — the CBT teacher's participation quota state (the navbar
 *                       meter + the blocked-room banner read this).
 * POST /api/cbt/quota — { action: 'request' } asks an admin for more
 *                       participations; { action: 'cancel' } withdraws it.
 *
 * Rides the already-registered, role-gated /api/cbt prefix (cbt_teacher only —
 * src/server/route-policy.ts), so no route-policy change is needed. Both verbs
 * live on this one shallow static file rather than child routes, per the Next-16
 * phantom-404 rule. Admin decisions live on /api/admin/cbt/teachers.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import {
  cancelParticipationRequest,
  createParticipationRequest,
  getCbtQuotaState,
} from "@/server/cbt/cbt-quota-service";
import { CBT_MAX_PARTICIPATION_QUOTA } from "@/lib/cbt/quota-model";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request"),
    additional: z.number().int().positive().max(CBT_MAX_PARTICIPATION_QUOTA),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({ action: z.literal("cancel"), requestId: z.string().min(1) }),
]);

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtParticipationQuota");
    const ctx = await requireCbtTeacher(request);
    return teacherJson(await getCbtQuotaState(ctx.cbtTeacherId));
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtParticipationQuota");
    const ctx = await requireCbtTeacher(request);
    const parsed = bodySchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    if (parsed.data.action === "request") {
      const created = await createParticipationRequest({
        teacherId: ctx.cbtTeacherId,
        actorUserId: ctx.userId,
        requestedAdditional: parsed.data.additional,
        note: parsed.data.note ?? null,
        requestIdHeader: requestIdOf(request),
      });
      return teacherJson({ request: created }, { status: 201 });
    }

    const cancelled = await cancelParticipationRequest({
      teacherId: ctx.cbtTeacherId,
      requestId: parsed.data.requestId,
      actorUserId: ctx.userId,
      requestIdHeader: requestIdOf(request),
    });
    return teacherJson({ request: cancelled });
  } catch (error) {
    return handleTeacherError(error);
  }
}

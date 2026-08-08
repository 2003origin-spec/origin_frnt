/**
 * GET    /api/admin/cbt/teachers  — list CBT teachers + usage stats + (behind
 *                                   cbtParticipationQuota) every teacher's
 *                                   participation cap/usage and the pending
 *                                   "need more" request queue.
 * POST   /api/admin/cbt/teachers  — add/re-activate a teacher   body: { email, displayName? }
 * PATCH  /api/admin/cbt/teachers  — per-teacher switches, one of:
 *                                     { id, reportCardsEnabled }            (legacy shape, kept)
 *                                     { action: 'set_quota', id, quota }    quota null = clear the cap
 *                                     { action: 'approve_quota', requestId, grantedQuota, note? }
 *                                     { action: 'reject_quota', requestId, note? }
 * DELETE /api/admin/cbt/teachers  — disable a teacher + revoke  body: { id? | email? }
 *
 * Rides the existing authenticated /api/admin prefix; admin-only in-handler.
 * Dark behind cbtModule. Every mutation is audited. All verbs and all quota
 * actions live on this one file rather than child routes — see the Next-16
 * phantom-404 incident.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { isFeatureEnabled, requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import {
  addCbtTeacher,
  getCbtUsageStats,
  listCbtTeachers,
  removeCbtTeacher,
  setCbtTeacherReportCards,
} from "@/server/cbt/cbt-teachers-service";
import {
  approveParticipationRequest,
  getCbtQuotaOverview,
  rejectParticipationRequest,
  setTeacherParticipationQuota,
} from "@/server/cbt/cbt-quota-admin-service";
import { CBT_MAX_PARTICIPATION_QUOTA, CBT_MAX_PERIOD_DAYS } from "@/lib/cbt/quota-model";

const addSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().max(120).nullable().optional(),
});

/**
 * PATCH accepts either the original report-cards shape (no `action`) or one of
 * the participation-quota actions. Kept as a union on one route so no new route
 * file is introduced.
 */
const patchSchema = z.union([
  z.object({
    action: z.undefined().optional(),
    id: z.string().min(1),
    reportCardsEnabled: z.boolean(),
  }),
  z.object({
    action: z.literal("set_quota"),
    id: z.string().min(1),
    /** `null` clears the cap (back to unlimited). */
    quota: z.number().int().positive().max(CBT_MAX_PARTICIPATION_QUOTA).nullable(),
    /**
     * The renewal policy. OMIT to leave the teacher's existing cycle untouched
     * (so bumping a number never silently re-anchors their billing period).
     */
    reset: z
      .object({
        mode: z.enum(["none", "monthly", "days"]),
        periodDays: z.number().int().positive().max(CBT_MAX_PERIOD_DAYS).nullable().optional(),
        /** ISO date/datetime the cycle counts from. Defaults to now. */
        anchor: z.string().min(1).nullable().optional(),
      })
      .optional(),
  }),
  z.object({
    action: z.literal("approve_quota"),
    requestId: z.string().min(1),
    /** The teacher's NEW TOTAL cap, not the increment. */
    grantedQuota: z.number().int().positive().max(CBT_MAX_PARTICIPATION_QUOTA),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    action: z.literal("reject_quota"),
    requestId: z.string().min(1),
    note: z.string().trim().max(500).nullable().optional(),
  }),
]);

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
    const [teachers, stats, quota] = await Promise.all([
      listCbtTeachers(),
      getCbtUsageStats(),
      isFeatureEnabled("cbtParticipationQuota") ? getCbtQuotaOverview() : Promise.resolve(null),
    ]);
    return teacherJson({ teachers, stats, quota });
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

export async function PATCH(request: NextRequest) {
  try {
    requireFeatureEnabled("cbtModule");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = patchSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.message }, { status: 400 });
    }

    // ── Participation quota actions ────────────────────────────────────────
    if (parsed.data.action) {
      requireFeatureEnabled("cbtParticipationQuota");
      const requestIdHeader = requestIdOf(request);

      if (parsed.data.action === "set_quota") {
        const result = await setTeacherParticipationQuota({
          actorUserId: ctx.userId,
          teacherId: parsed.data.id,
          quota: parsed.data.quota,
          reset: parsed.data.reset,
          requestIdHeader,
        });
        return teacherJson(result);
      }

      if (parsed.data.action === "approve_quota") {
        const result = await approveParticipationRequest({
          actorUserId: ctx.userId,
          requestId: parsed.data.requestId,
          grantedQuota: parsed.data.grantedQuota,
          note: parsed.data.note ?? null,
          requestIdHeader,
        });
        return teacherJson(result);
      }

      await rejectParticipationRequest({
        actorUserId: ctx.userId,
        requestId: parsed.data.requestId,
        note: parsed.data.note ?? null,
        requestIdHeader,
      });
      return teacherJson({ ok: true });
    }

    // ── Premium report-card switch (original shape) ────────────────────────
    requireFeatureEnabled("cbtReportCards");
    const teacher = await setCbtTeacherReportCards(parsed.data.id, parsed.data.reportCardsEnabled);
    if (!teacher) {
      return teacherJson({ detail: "CBT teacher not found." }, { status: 404 });
    }
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "cbt_teacher",
      entityId: teacher.id,
      action: parsed.data.reportCardsEnabled
        ? "admin.cbt_report_cards_enabled"
        : "admin.cbt_report_cards_disabled",
      after: { email: teacher.email, reportCardsEnabled: teacher.reportCardsEnabled },
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

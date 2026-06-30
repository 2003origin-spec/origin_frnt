/**
 * GET   /api/admin/coupons   — list all coupons + redemption counts
 * POST  /api/admin/coupons   — create/upsert a coupon
 * PATCH /api/admin/coupons   — enable/disable a coupon {code, active}
 *
 * Admin-only (enforced here + by the authenticated /api/admin route policy).
 * Gated by adminCoupons. Coupons discount PLATFORM subject/bundle subscriptions.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { ALL_SUBJECTS } from "@/lib/entitlements";
import { createCoupon, listCoupons, setCouponActive } from "@/server/pricing/coupons-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  description: z.string().max(200).optional(),
  kind: z.enum(["percent", "flat"]),
  value: z.number().int().min(0).max(100_000_00),
  appliesTo: z.enum(["subject", "bundle", "any"]).default("any"),
  subject: z.enum(ALL_SUBJECTS as [string, ...string[]]).optional(),
  coachingCenterWorkspaceId: z.string().optional(),
  maxRedemptions: z.number().int().min(1).optional(),
  perUserLimit: z.number().int().min(1).max(100).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

const ToggleSchema = z.object({ code: z.string().trim().min(2), active: z.boolean() });

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminCoupons");
    await requireRole(request, ["admin"]);
    return teacherJson({ coupons: await listCoupons() });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("adminCoupons");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = CreateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    if (parsed.data.kind === "percent" && parsed.data.value > 100) {
      return teacherJson({ detail: "A percent coupon cannot exceed 100." }, { status: 400 });
    }
    const coupon = await createCoupon({
      ...parsed.data,
      subject: parsed.data.subject ?? null,
      createdBy: ctx.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "coupon",
      entityId: coupon.code,
      action: "coupon.created",
      after: coupon,
    });
    return teacherJson(coupon, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireFeatureEnabled("adminCoupons");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = ToggleSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    await setCouponActive(parsed.data.code, parsed.data.active);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "coupon",
      entityId: parsed.data.code,
      action: parsed.data.active ? "coupon.enabled" : "coupon.disabled",
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

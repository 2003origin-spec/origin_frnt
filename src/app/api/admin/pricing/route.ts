/**
 * GET   /api/admin/pricing            — current subject prices + active bundle
 * POST  /api/admin/pricing            — set a subject price {subject, amountMinor}
 * PATCH /api/admin/pricing            — upsert the bundle offer {name, subjects, amountMinor, active}
 *
 * Admin-only (enforced here + by the authenticated /api/admin route policy).
 * Gated by the adminPricing feature flag. Writes create a fresh Razorpay plan so
 * NEW subscriptions bill the new amount (existing subscriptions untouched).
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { ALL_SUBJECTS } from "@/lib/entitlements";
import {
  deactivateTermOption,
  getAdminPricing,
  setSubjectPrice,
  upsertBundle,
  upsertTermOption,
} from "@/server/pricing/pricing-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const SetSubjectSchema = z.object({
  subject: z.enum(ALL_SUBJECTS as [string, ...string[]]),
  amountMinor: z.number().int().min(0).max(100_000_00),
  listAmountMinor: z.number().int().min(0).max(100_000_00).nullable().optional(),
});

const BundleSchema = z.object({
  kind: z.literal("bundle").optional(),
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  subjects: z
    .array(z.enum(ALL_SUBJECTS as [string, ...string[]]))
    .min(1)
    .transform((subjects) => Array.from(new Set(subjects))),
  amountMinor: z.number().int().min(0).max(100_000_00),
  listAmountMinor: z.number().int().min(0).max(100_000_00).nullable().optional(),
  active: z.boolean(),
});

const TermSchema = z.object({
  kind: z.literal("term"),
  termMonths: z.number().int().positive().max(120),
  label: z.string().trim().min(1).max(80),
  discountPercent: z.number().int().min(0).max(90),
  sortOrder: z.number().int().min(0).max(10_000),
  active: z.boolean(),
});

const DeactivateTermSchema = z.object({
  termMonths: z.number().int().positive().max(120),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("adminPricing");
    await requireRole(request, ["admin"]);
    return teacherJson(await getAdminPricing());
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("adminPricing");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = SetSubjectSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const updated = await setSubjectPrice({
      subject: parsed.data.subject as (typeof ALL_SUBJECTS)[number],
      amountMinor: parsed.data.amountMinor,
      listAmountMinor: parsed.data.listAmountMinor,
      adminUserId: ctx.userId,
    });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "subject_price",
      entityId: parsed.data.subject,
      action: "pricing.subject_updated",
      after: updated,
    });
    return teacherJson(updated);
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireFeatureEnabled("adminPricing");
    const ctx = await requireRole(request, ["admin"]);
    const body = await parseJsonBody(request);
    if (body && typeof body === "object" && (body as { kind?: unknown }).kind === "term") {
      const parsed = TermSchema.safeParse(body);
      if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
      const term = await upsertTermOption({ ...parsed.data, adminUserId: ctx.userId });
      await recordAuditEvent({
        actorUserId: ctx.userId,
        workspaceId: null,
        entityType: "pricing_term",
        entityId: String(term.termMonths),
        action: "pricing.term_updated",
        after: term,
      });
      return teacherJson(term);
    }

    const parsed = BundleSchema.safeParse(body);
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const bundle = await upsertBundle({ ...parsed.data, adminUserId: ctx.userId });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "bundle_offer",
      entityId: bundle.id,
      action: "pricing.bundle_updated",
      after: bundle,
    });
    return teacherJson(bundle);
  } catch (error) {
    return handleTeacherError(error);
  }
}

/** Deactivate a term row without deleting its history. */
export async function DELETE(request: NextRequest) {
  try {
    requireFeatureEnabled("adminPricing");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = DeactivateTermSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const changed = await deactivateTermOption(parsed.data.termMonths, ctx.userId);
    if (!changed) return teacherJson({ detail: "Term option not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "pricing_term",
      entityId: String(parsed.data.termMonths),
      action: "pricing.term_deactivated",
      after: { termMonths: parsed.data.termMonths, active: false },
    });
    return teacherJson({ ok: true, termMonths: parsed.data.termMonths, active: false });
  } catch (error) {
    return handleTeacherError(error);
  }
}

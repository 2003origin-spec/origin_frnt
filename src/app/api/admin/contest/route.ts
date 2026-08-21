/**
 * GET  /api/admin/contest  — list all contests (admin overview)
 * POST /api/admin/contest  — create a draft contest
 *
 * Admin-only (enforced here + by the authenticated /api/admin route policy).
 * Gated by the `contest` feature flag. Wraps the tested contest-admin-service.
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { createContest, listContests } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subjects: z.array(z.string()).optional(),
  topics: z.record(z.string(), z.array(z.string())).optional(),
  bannerUrl: z.string().url().nullable().optional(),
  displayTz: z.string().optional(),
  // Coerced/validated by the service (normalizeScoringConfig); keep it loose here.
  scoringConfig: z.unknown().optional(),
  ogcodeReward: z.number().int().min(0).optional(),
});

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    return teacherJson({ contests: await listContests() });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const parsed = CreateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const contest = await createContest(ctx.userId, parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.created",
      after: contest,
    });
    return teacherJson({ contest }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

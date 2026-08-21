/**
 * GET   /api/admin/contest/[id]  — fetch one contest
 * PATCH /api/admin/contest/[id]  — update a DRAFT contest (name/subjects/topics/
 *                                  banner/tz/scoring/reward/schedule windows)
 *
 * Admin-only + `contest` flag. Updates are rejected once the contest is
 * published (status != 'draft'), enforced in the service.
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 0.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { getContest, updateContest } from "@/server/contest/contest-admin-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const isoOrNull = z.string().datetime({ offset: true }).nullable();

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  subjects: z.array(z.string()).optional(),
  topics: z.record(z.string(), z.array(z.string())).optional(),
  bannerUrl: z.string().url().nullable().optional(),
  displayTz: z.string().optional(),
  scoringConfig: z.unknown().optional(),
  ogcodeReward: z.number().int().min(0).optional(),
  regOpen: isoOrNull.optional(),
  regClose: isoOrNull.optional(),
  startAt: isoOrNull.optional(),
  endAt: isoOrNull.optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const contest = await getContest(id);
    if (!contest) return teacherJson({ detail: "Contest not found." }, { status: 404 });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = UpdateSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const before = await getContest(id);
    const contest = await updateContest(id, parsed.data);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: contest.id,
      action: "contest.updated",
      before: before ?? undefined,
      after: contest,
    });
    return teacherJson({ contest });
  } catch (error) {
    return handleTeacherError(error);
  }
}

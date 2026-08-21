/**
 * GET  /api/admin/contest/[id]/review           — list flagged attempts.
 * POST /api/admin/contest/[id]/review           — { userId, action: clear|uphold }
 *
 * Admin anti-cheat review. Clearing/upholding after publish recomputes the
 * leaderboard + ORBIT (replay). Admin-only + `contest` flag; audited.
 * Plan Phase 5.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import {
  clearFlaggedAttempt,
  listFlaggedAttempts,
  upholdFlaggedAttempt,
} from "@/server/contest/contest-review-service";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await context.params;
    return teacherJson({ flagged: await listFlaggedAttempts(id) });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const ReviewSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["clear", "uphold"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { id } = await context.params;
    const parsed = ReviewSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });

    const { userId, action } = parsed.data;
    if (action === "clear") await clearFlaggedAttempt(id, userId);
    else await upholdFlaggedAttempt(id, userId);

    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "contest",
      entityId: id,
      action: `contest.review.${action}`,
      after: { userId, action },
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

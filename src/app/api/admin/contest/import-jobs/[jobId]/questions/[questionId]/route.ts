/**
 * POST /api/admin/contest/import-jobs/[jobId]/questions/[questionId]
 *   body { action: "publish", override?, practiceEligible? } — accept + publish
 *         the question into the OGCode bank as a contest import.
 *   body { action: "reject", reason? }                       — reject it.
 *
 * Admin-only + `contest` flag. Publishing enforces the contest MCQ invariant
 * (≥2 options, a correct option, a subject, and a chapter); a non-eligible
 * question returns 400 with the reason.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  publishContestImportQuestion,
  rejectContestImportQuestion,
  type ContestImportOverride,
} from "@/server/contest/contest-import-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; questionId: string }> },
) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { jobId, questionId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      override?: ContestImportOverride;
      practiceEligible?: boolean;
      reason?: string | null;
    };

    if (body.action === "reject") {
      await rejectContestImportQuestion({ userId: ctx.userId, jobId, questionId, reason: body.reason ?? null });
      return teacherJson({ ok: true });
    }

    // Default action = publish.
    const result = await publishContestImportQuestion({
      userId: ctx.userId,
      jobId,
      questionId,
      override: body.override,
      practiceEligible: body.practiceEligible ?? false,
    });
    return teacherJson({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

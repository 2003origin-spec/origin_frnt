/**
 * GET    /api/admin/contest/import-jobs/[jobId]  — job progress + extracted questions
 * DELETE /api/admin/contest/import-jobs/[jobId]  — delete a queued/processing job
 *
 * Admin-only + `contest` flag. The job is addressed through the admin's own
 * synthetic import workspace, so a jobId owned by another admin never resolves.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { deleteContestImportJob, getContestImportJob } from "@/server/contest/contest-import-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { jobId } = await params;
    const result = await getContestImportJob(ctx.userId, jobId);
    if (!result) return teacherJson({ detail: "Import job not found." }, { status: 404 });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { jobId } = await params;
    await deleteContestImportJob({
      userId: ctx.userId,
      jobId,
      requestId: request.headers.get("x-request-id"),
    });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

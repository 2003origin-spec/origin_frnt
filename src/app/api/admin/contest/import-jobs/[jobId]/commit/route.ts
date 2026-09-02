/**
 * POST /api/admin/contest/import-jobs/[jobId]/commit
 *   body { practiceEligible?: boolean }
 *
 * Bulk-publishes every `accepted` import question that satisfies the contest MCQ
 * invariant into the OGCode bank as contest imports. Non-eligible rows are
 * skipped (reported in the count), never failing the whole commit. Admin-only +
 * `contest` flag.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { commitContestImportJob } from "@/server/contest/contest-import-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const { jobId } = await params;
    const body = (await request.json().catch(() => ({}))) as { practiceEligible?: boolean };
    const result = await commitContestImportJob({
      userId: ctx.userId,
      jobId,
      practiceEligible: body.practiceEligible ?? false,
    });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

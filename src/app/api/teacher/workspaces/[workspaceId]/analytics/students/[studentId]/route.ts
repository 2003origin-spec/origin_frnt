import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { getStudentTopicProfileLive } from "@/server/workspaces/batch-cohort-store";
import { getStudentDeepProfile } from "@/server/workspaces/workspace-analytics-service";

import {
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "../../../../../_utils";

export async function GET(
  request: NextRequest,
  context: WorkspaceIdRouteContext & { params: Promise<{ workspaceId: string; studentId: string }> },
) {
  try {
    requireFeatureEnabled("teacherAnalytics");
    const { workspaceId, studentId } = await context.params;
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");

    // `type=full` → the 360° profile. Folded into this already-registered route
    // rather than a `full/` child path (plan D1 — the Next.js 16 new-route 404).
    if (url.searchParams.get("type") === "full") {
      requireFeatureEnabled("teacherDeepAnalytics");
      const profile = await getStudentDeepProfile(workspaceId, studentId);
      if (!profile) {
        // Not enrolled in THIS workspace — deliberately indistinguishable from
        // "no such student", which is the right answer to give either way.
        return teacherJson({ detail: "Student not found in this workspace." }, { status: 404 });
      }
      return teacherJson({ profile });
    }

    const profiles = await getStudentTopicProfileLive(workspaceId, studentId, subject ?? undefined);
    return teacherJson({ profiles });
  } catch (error) {
    return handleTeacherError(error);
  }
}

import type { NextRequest } from "next/server";

import { isFeatureEnabled, requireFeatureEnabled } from "@/lib/feature-flags";
import {
  clampPage,
  clampPageSize,
  parseSortDirection,
  parseStudentSort,
} from "@/lib/teacher-analytics";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { listEnrollments } from "@/server/workspaces/enrollments";
import { listDirectoryStudents } from "@/server/workspaces/workspace-analytics-service";
import type { EnrollmentStatus } from "@/server/workspaces/types";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const ALLOWED_STATUSES: EnrollmentStatus[] = ["unassigned", "active", "suspended", "left"];

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("enrollment");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher", "content_manager", "analyst"]);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status =
      rawStatus && (ALLOWED_STATUSES.includes(rawStatus as EnrollmentStatus) || rawStatus === "all")
        ? (rawStatus as EnrollmentStatus | "all")
        : undefined;

    // Directory mode: server-side search + sort + pagination + performance
    // metrics. Opted into with `?directory=1` so the parameterless response
    // stays byte-compatible with the pre-upgrade `{ students }` shape that other
    // callers still rely on. Folded into this route rather than a new child path
    // (plan D1 — the Next.js 16 new-route 404).
    if (url.searchParams.get("directory") === "1" && isFeatureEnabled("teacherDeepAnalytics")) {
      // `status` accepts a comma-separated list here (the directory's
      // "Suspended / Left" tab is two statuses); anything unrecognised is
      // dropped rather than reaching SQL.
      const statuses = (rawStatus ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is EnrollmentStatus =>
          ALLOWED_STATUSES.includes(value as EnrollmentStatus),
        );
      const result = await listDirectoryStudents({
        workspaceId,
        query: url.searchParams.get("q"),
        batchId: url.searchParams.get("batchId"),
        statuses,
        sort: parseStudentSort(url.searchParams.get("sort")),
        direction: parseSortDirection(url.searchParams.get("dir")),
        page: clampPage(url.searchParams.get("page")),
        pageSize: clampPageSize(url.searchParams.get("pageSize")),
      });
      return teacherJson(result);
    }

    const students = await listEnrollments(workspaceId, { status });
    return teacherJson({ students });
  } catch (error) {
    return handleTeacherError(error);
  }
}

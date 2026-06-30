import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { getBrowsableInstituteProfile } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const { workspaceId } = await context.params;
    // Gated browse profile — null/404 for an unapproved institute when the gate is on.
    const profile = await getBrowsableInstituteProfile(workspaceId);
    if (!profile) {
      return teacherJson({ detail: "Institute not found or not public." }, { status: 404 });
    }
    return teacherJson({ profile });
  } catch (error) {
    return handleTeacherError(error);
  }
}

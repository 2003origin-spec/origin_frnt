/**
 * GET /api/admin/contest/chapters?subject=Physics
 *
 * Returns the distinct OGCode chapters for a subject, so the contest admin
 * builder can offer a per-subject topic (chapter) picker. Admin-only + `contest`
 * flag. Read-only.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listOgcodeCatalogChapters } from "@/server/ogcode-catalog";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const subject = new URL(request.url).searchParams.get("subject");
    if (!subject) return teacherJson({ detail: "subject is required." }, { status: 400 });
    const chapters = await listOgcodeCatalogChapters(subject);
    return teacherJson({ chapters });
  } catch (error) {
    return handleTeacherError(error);
  }
}

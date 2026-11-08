/**
 * GET /api/marketplace/institutes(?subject=&city=&limit=&offset=)
 * Public institute directory.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { listBrowsableInstitutes } from "@/server/connect/connect-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("paidEnrollment");
    const url = new URL(request.url);
    const subject = url.searchParams.get("subject");
    const city = url.searchParams.get("city");
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit ? Math.min(Math.max(Number(rawLimit) || 0, 1), 100) : undefined;
    const rawOffset = url.searchParams.get("offset");
    const offset = rawOffset ? Math.min(Math.max(Math.trunc(Number(rawOffset)) || 0, 0), 10_000) : undefined;
    // Routed through the gated browse fn so the approval gate applies to this
    // discovery surface too (active-collaborators-only when the flag is on).
    const institutes = await listBrowsableInstitutes({
      subject: subject ?? undefined,
      city: city ?? undefined,
      limit,
      offset,
    });
    return teacherJson({ institutes });
  } catch (error) {
    return handleTeacherError(error);
  }
}

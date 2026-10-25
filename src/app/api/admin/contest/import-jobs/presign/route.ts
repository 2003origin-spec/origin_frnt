/**
 * POST /api/admin/contest/import-jobs/presign   { fileName, mimeType, size }
 *
 * Returns a short-lived presigned R2 PUT URL so the browser can upload a large
 * PDF/DOCX DIRECTLY to R2, bypassing Vercel's ~4.5 MB serverless body limit.
 * The URL is signed for this file's type and exact size: the browser PUTs the
 * same file with the returned `uploadHeaders`. The client then calls
 * POST /api/admin/contest/import-jobs with the returned objectKey + uploadToken
 * to register the job. Admin-only + `contest` flag.
 */

// audit-skip: returns a short-lived presigned R2 upload URL; creates no state (the job-create POST is audited).
import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { presignImportUpload } from "@/server/media-storage";

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const body = (await request.json().catch(() => ({}))) as { fileName?: unknown; mimeType?: unknown; size?: unknown };
    // Import sources are private: the presign helper signs against R2_PRIVATE_BUCKET.
    // The uploadToken binds the key to this admin for the job-create step.
    return teacherJson(presignImportUpload(body, ctx.userId));
  } catch (error) {
    return handleTeacherError(error);
  }
}

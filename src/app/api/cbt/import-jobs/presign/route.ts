/**
 * POST /api/cbt/import-jobs/presign   { fileName, mimeType, size }
 *
 * Returns a short-lived presigned R2 PUT URL so the browser can upload a large
 * PDF/DOCX DIRECTLY to R2, bypassing Vercel's ~4.5 MB serverless body limit.
 * The URL is signed for this file's type and exact size: the browser PUTs the
 * same file with the returned `uploadHeaders`. The client then calls
 * POST /api/cbt/import-jobs with the returned objectKey + uploadToken to create
 * the job (small JSON — no body-limit problem).
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { presignImportUpload } from "@/server/media-storage";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await request.json().catch(() => ({}))) as { fileName?: unknown; mimeType?: unknown; size?: unknown };
    // Import sources are private: the presign helper signs against R2_PRIVATE_BUCKET.
    // The uploadToken binds the key to this teacher for the job-create step.
    return teacherJson(presignImportUpload(body, ctx.userId));
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * POST /api/admin/contest/import-jobs/presign
 *
 * Returns a short-lived presigned R2 PUT URL so the browser can upload a large
 * PDF/DOCX DIRECTLY to R2, bypassing Vercel's ~4.5 MB serverless body limit.
 * The client then calls POST /api/admin/contest/import-jobs with the returned
 * objectKey to register the job. Admin-only + `contest` flag.
 */

// audit-skip: returns a short-lived presigned R2 upload URL; creates no state (the job-create POST is audited).
import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import {
  createImportUploadObjectKey,
  createPresignedR2PutUrl,
  importR2BucketName,
  isAllowedImportDocumentMimeType,
} from "@/server/media-storage";

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const body = (await request.json().catch(() => ({}))) as { fileName?: string; mimeType?: string };
    const fileName = typeof body.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : "document";
    const mimeType = (typeof body.mimeType === "string" ? body.mimeType : "").toLowerCase();
    if (!isAllowedImportDocumentMimeType(mimeType)) {
      return teacherJson({ detail: "Only PDF, DOCX, JPEG, PNG, or WebP files can be imported." }, { status: 400 });
    }
    const objectKey = createImportUploadObjectKey(fileName);
    const presigned = createPresignedR2PutUrl({ objectKey, expiresSeconds: 600 });
    return teacherJson({
      uploadUrl: presigned.url,
      objectKey: presigned.objectKey,
      bucket: presigned.bucket ?? importR2BucketName(),
    });
  } catch (error) {
    return handleTeacherError(error);
  }
}

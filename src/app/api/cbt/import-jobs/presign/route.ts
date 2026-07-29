/**
 * POST /api/cbt/import-jobs/presign
 *
 * Returns a short-lived presigned R2 PUT URL so the browser can upload a large
 * PDF/DOCX DIRECTLY to R2, bypassing Vercel's ~4.5 MB serverless body limit.
 * The client then calls POST /api/cbt/import-jobs with the returned objectKey
 * to create the job (small JSON — no body-limit problem).
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import {
  createImportUploadObjectKey,
  createPresignedR2PutUrl,
  importR2BucketName,
  isAllowedImportDocumentMimeType,
} from "@/server/media-storage";

export async function POST(request: NextRequest) {
  try {
    await requireCbtTeacher(request);
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

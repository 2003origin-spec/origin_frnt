/**
 * GET  /api/cbt/import-jobs  — list the teacher's import jobs
 * POST /api/cbt/import-jobs  — upload a PDF/DOCX (multipart form, field "file")
 *
 * Reuses the shared document-import worker via a synthetic per-teacher
 * workspace. Nothing here touches content.questions.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createCbtImportJob, listCbtImportJobs } from "@/server/cbt/cbt-import-service";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const jobs = await listCbtImportJobs(ctx.cbtTeacher);
    return teacherJson({ jobs });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);

    // JSON path: the browser already PUT the file to R2 via a presigned URL
    // (large files — bypasses the ~4.5 MB serverless body limit). We just
    // register the job against that R2 object.
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        objectKey?: string; bucket?: string; fileName?: string; mimeType?: string; size?: number;
      };
      if (!body.objectKey || !body.bucket) {
        return teacherJson({ detail: "objectKey and bucket are required." }, { status: 400 });
      }
      const job = await createCbtImportJob({
        teacher: ctx.cbtTeacher,
        userId: ctx.userId,
        r2Object: {
          objectKey: body.objectKey,
          bucket: body.bucket,
          fileName: body.fileName || "upload",
          mimeType: body.mimeType || "application/octet-stream",
          sizeBytes: typeof body.size === "number" ? body.size : undefined,
        },
      });
      return teacherJson({ job }, { status: 201 });
    }

    // Multipart path: small files still upload through the server.
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return teacherJson({ detail: "A file is required." }, { status: 400 });
    }
    if (file.size === 0) return teacherJson({ detail: "The file is empty." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) {
      return teacherJson({ detail: "File is too large (max 25 MB)." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const job = await createCbtImportJob({
      teacher: ctx.cbtTeacher,
      userId: ctx.userId,
      file: {
        buffer,
        fileName: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
      },
    });
    return teacherJson({ job }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

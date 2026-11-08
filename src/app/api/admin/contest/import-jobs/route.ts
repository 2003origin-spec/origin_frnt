/**
 * GET  /api/admin/contest/import-jobs  — list the admin's contest import jobs
 * POST /api/admin/contest/import-jobs  — upload a PDF/DOCX (multipart field "file")
 *                                        or register an R2-presigned object (JSON)
 *
 * Reuses the shared document-import worker via a synthetic per-admin workspace
 * (contest.admin_import_workspaces). Admin-only + `contest` flag. Nothing here
 * publishes questions — that is a separate review/commit step.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { createContestImportJob, listContestImportJobs } from "@/server/contest/contest-import-service";
import { MAX_IMPORT_DOCUMENT_BYTES } from "@/server/media-storage";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const jobs = await listContestImportJobs(ctx.userId);
    return teacherJson({ jobs });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);

    // JSON path: the browser already PUT the file to R2 via a presigned URL.
    // The bucket is always the server's private bucket — a `bucket` the
    // browser sends is ignored — and the key must come with the uploadToken
    // the presign route issued to this admin.
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = (await request.json().catch(() => ({}))) as {
        objectKey?: string; uploadToken?: string; fileName?: string; mimeType?: string; size?: number;
      };
      if (!body.objectKey) {
        return teacherJson({ detail: "objectKey is required." }, { status: 400 });
      }
      // Issued by the presign route for this user and key; a tab opened before
      // tokens existed sends none and is asked to upload again.
      if (typeof body.uploadToken !== "string" || !body.uploadToken) {
        return teacherJson({ detail: "uploadToken is required. Please upload the file again." }, { status: 400 });
      }
      const job = await createContestImportJob({
        userId: ctx.userId,
        r2Object: {
          objectKey: body.objectKey,
          uploadToken: body.uploadToken,
          fileName: body.fileName || "upload",
          mimeType: body.mimeType || "application/octet-stream",
          sizeBytes: typeof body.size === "number" ? body.size : undefined,
        },
      });
      return teacherJson({ job }, { status: 201 });
    }

    // Multipart path: small files upload through the server.
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return teacherJson({ detail: "A file is required." }, { status: 400 });
    }
    if (file.size === 0) return teacherJson({ detail: "The file is empty." }, { status: 400 });
    if (file.size > MAX_IMPORT_DOCUMENT_BYTES) {
      return teacherJson({ detail: "File is too large (max 25 MB)." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const job = await createContestImportJob({
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

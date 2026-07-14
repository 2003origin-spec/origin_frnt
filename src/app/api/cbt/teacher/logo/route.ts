/**
 * Institute logo shown on the student thank-you screen (cbt.teachers.logo).
 *
 * POST   /api/cbt/teacher/logo — upload an image to R2 + save its URL. (multipart: `file`)
 * DELETE /api/cbt/teacher/logo — clear the logo.
 *
 * Role-gated to cbt_teacher (middleware) + requireCbtTeacher (active allowlist).
 */
import { NextRequest, NextResponse } from "next/server";

import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { updateCbtTeacherLogo } from "@/server/cbt/cbt-teachers-service";
import { uploadImageToR2 } from "@/server/media-storage";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — a logo, not a document

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
      return NextResponse.json({ detail: "Logo image is required." }, { status: 400 });
    }
    const f = file as File;
    const mimeType = (f.type || "application/octet-stream").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ detail: "Only image files can be uploaded." }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ detail: "Logo is too large (max 5 MB)." }, { status: 400 });
    }

    const body = Buffer.from(await f.arrayBuffer());
    const upload = await uploadImageToR2({
      userId: ctx.userId,
      purpose: "cbt_institute_logo",
      fileName: f.name || "logo.png",
      mimeType,
      body,
    });
    await updateCbtTeacherLogo(ctx.cbtTeacherId, upload.publicUrl);
    return NextResponse.json({ url: upload.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("not active") || message.includes("authoriz") ? 403 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    await updateCbtTeacherLogo(ctx.cbtTeacherId, null);
    return NextResponse.json({ url: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove logo.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

/**
 * POST /api/cbt/uploads/image — upload a question diagram image to R2.
 *
 * Role-gated to cbt_teacher (middleware) + requireCbtTeacher (active allowlist).
 * Returns the public R2 URL; the caller (question editor) stores it on the
 * question via the normal create/update endpoints. Multipart form-data: `file`.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { uploadImageToR2 } from "@/server/media-storage";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
      return NextResponse.json({ detail: "Image file is required." }, { status: 400 });
    }
    const f = file as File;
    const mimeType = (f.type || "application/octet-stream").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ detail: "Only image files can be uploaded." }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ detail: "Image is too large (max 10 MB)." }, { status: 400 });
    }

    const body = Buffer.from(await f.arrayBuffer());
    const upload = await uploadImageToR2({
      userId: ctx.userId,
      purpose: "cbt_question_image",
      fileName: f.name || "question.png",
      mimeType,
      body,
    });
    return NextResponse.json({ url: upload.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("Not authorized") || message.includes("teacher") ? 403 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

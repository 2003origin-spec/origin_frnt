/**
 * Admin control for the home Monthly-Championship prize (retention Layer 4).
 *
 * GET    /api/admin/championship — current { imageUrl, label }.
 * POST   /api/admin/championship — upload the prize photo to R2 + save its URL. (multipart: `file`)
 * PATCH  /api/admin/championship — set the prize label. { label }
 * DELETE /api/admin/championship — clear the prize photo.
 *
 * Admin-gated (middleware /admin + requireRole(["admin"])).
 */
import { NextRequest, NextResponse } from "next/server";

import { parseJsonBody } from "@/server/http";
import { requireRole } from "@/server/authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { uploadImageToR2 } from "@/server/media-storage";
import {
  getChampionshipPrize,
  setChampionshipPrizeImageUrl,
  setChampionshipPrizeLabel,
} from "@/server/platform-settings";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — a photo, not a document

export async function GET(request: NextRequest) {
  await requireRole(request, ["admin"]);
  return NextResponse.json(await getChampionshipPrize());
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string" || typeof (file as File).arrayBuffer !== "function") {
      return NextResponse.json({ detail: "Prize image is required." }, { status: 400 });
    }
    const f = file as File;
    const mimeType = (f.type || "application/octet-stream").toLowerCase();
    if (!mimeType.startsWith("image/")) {
      return NextResponse.json({ detail: "Only image files can be uploaded." }, { status: 400 });
    }
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ detail: "Image is too large (max 5 MB)." }, { status: 400 });
    }

    const body = Buffer.from(await f.arrayBuffer());
    const upload = await uploadImageToR2({
      userId: ctx.userId,
      purpose: "championship_prize",
      fileName: f.name || "prize.png",
      mimeType,
      body,
    });
    await setChampionshipPrizeImageUrl(upload.publicUrl, ctx.userId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "championship_prize",
      entityId: "championship",
      action: "championship_prize.image_updated",
      after: { imageUrl: upload.publicUrl },
    });
    return NextResponse.json({ url: upload.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    const status = message.includes("authoriz") || message.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    const body = (await parseJsonBody(request)) as { label?: string | null };
    await setChampionshipPrizeLabel(body?.label ?? null, ctx.userId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "championship_prize",
      entityId: "championship",
      action: "championship_prize.label_updated",
      after: { label: body?.label ?? null },
    });
    return NextResponse.json({ label: body?.label ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save the label.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    await setChampionshipPrizeImageUrl(null, ctx.userId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "championship_prize",
      entityId: "championship",
      action: "championship_prize.image_cleared",
    });
    return NextResponse.json({ url: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove the image.";
    return NextResponse.json({ detail: message }, { status: 500 });
  }
}

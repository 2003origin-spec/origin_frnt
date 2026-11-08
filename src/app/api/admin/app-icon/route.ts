/**
 * Admin control for the native app's launcher icon (festival editions).
 *
 * GET /api/admin/app-icon — { icon, icons } (current choice, null = never set).
 * PUT /api/admin/app-icon — { icon } one of src/lib/app-icons.ts. Phones switch the
 *     next time the app goes to the background after reading /api/mobile/config
 *     (CDN-cached 60 s). Only builds with the icon inside them (20018+) can show it.
 *
 * Admin-gated (middleware /admin + requireRole(["admin"])).
 */
import { NextRequest, NextResponse } from "next/server";

import { APP_ICONS, isAppIconId } from "@/lib/app-icons";
import { authzErrorResponse, requireRole } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { getAppIcon, setAppIcon } from "@/server/platform-settings";
import { recordAuditEvent } from "@/server/workspaces/audit";

async function admin(request: NextRequest): Promise<{ userId: string } | Response> {
  try {
    return await requireRole(request, ["admin"]);
  } catch (error) {
    return authzErrorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  const ctx = await admin(request);
  if (ctx instanceof Response) return ctx;
  try {
    return NextResponse.json({ icon: await getAppIcon(), icons: APP_ICONS });
  } catch {
    return NextResponse.json({ detail: "Could not load the app icon." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctx = await admin(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = (await parseJsonBody(request)) as { icon?: unknown } | null;
    const icon = body?.icon;
    if (!isAppIconId(icon)) {
      return NextResponse.json({ detail: "Pick one of the app's icons." }, { status: 400 });
    }
    const before = await getAppIcon();
    await setAppIcon(icon, ctx.userId);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "app_icon",
      entityId: "app_icon",
      action: "app_icon.updated",
      before: { icon: before },
      after: { icon },
    });
    return NextResponse.json({ icon });
  } catch {
    return NextResponse.json({ detail: "Could not save the app icon." }, { status: 500 });
  }
}

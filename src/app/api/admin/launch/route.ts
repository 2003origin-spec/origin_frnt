/**
 * GET  /api/admin/launch  — read the launch settings.
 * PATCH /api/admin/launch — update any of allowLogin / allowSignup /
 *                           coverEnabled / launchAt. Admin-gated + audit-logged.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/server/authz";
import { getLaunchSettings, updateLaunchSettings, type LaunchSettings } from "@/server/launch-settings";
import { recordAuditEvent } from "@/server/workspaces/audit";

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    return NextResponse.json(await getLaunchSettings());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load launch settings.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    const body = (await request.json().catch(() => ({}))) as Partial<LaunchSettings>;
    const patch: Partial<LaunchSettings> = {};
    if (typeof body.allowLogin === "boolean") patch.allowLogin = body.allowLogin;
    if (typeof body.allowSignup === "boolean") patch.allowSignup = body.allowSignup;
    if (typeof body.coverEnabled === "boolean") patch.coverEnabled = body.coverEnabled;
    if ("launchAt" in body) {
      patch.launchAt = typeof body.launchAt === "string" && body.launchAt.trim() ? body.launchAt : null;
    }
    const next = await updateLaunchSettings(patch);
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "launch_settings",
      entityId: "launch",
      action: "launch_settings.updated",
      after: next,
    });
    return NextResponse.json(next);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update launch settings.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}

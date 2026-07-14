/**
 * PATCH /api/admin/ogcode/reports/[reportId]  — move a report through triage.
 * Body: { status: "open" | "reviewing" | "resolved" | "dismissed" }. Admin-gated.
 */
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/server/authz";
import { updateOgcodeReportStatus, isOgcodeReportStatus } from "@/server/ogcode-reports";
import { recordAuditEvent } from "@/server/workspaces/audit";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reportId: string }> }) {
  try {
    const ctx = await requireRole(request, ["admin"]);
    const { reportId } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    if (!body.status || !isOgcodeReportStatus(body.status)) {
      return NextResponse.json({ detail: "Invalid status." }, { status: 400 });
    }
    const result = await updateOgcodeReportStatus(reportId, body.status);
    if (!result.ok) return NextResponse.json({ detail: "Report not found." }, { status: 404 });
    await recordAuditEvent({
      actorUserId: ctx.userId,
      workspaceId: null,
      entityType: "ogcode_report",
      entityId: reportId,
      action: "ogcode_report.status_changed",
      after: { status: body.status },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update report.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}

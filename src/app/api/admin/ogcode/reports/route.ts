/**
 * GET  /api/admin/ogcode/reports?status=open  — list student-reported issues.
 * Admin-gated (requireRole).
 */
import { NextRequest, NextResponse } from "next/server";

import { requireRole } from "@/server/authz";
import {
  listOgcodeQuestionReports,
  getOgcodeReportStatusCounts,
  isOgcodeReportStatus,
} from "@/server/ogcode-reports";

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, ["admin"]);
    const statusParam = request.nextUrl.searchParams.get("status");
    const status = statusParam && isOgcodeReportStatus(statusParam) ? statusParam : undefined;
    const [reports, counts] = await Promise.all([
      listOgcodeQuestionReports({ status }),
      getOgcodeReportStatusCounts(),
    ]);
    return NextResponse.json({ reports, counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load reports.";
    return NextResponse.json({ detail: message }, { status: 403 });
  }
}

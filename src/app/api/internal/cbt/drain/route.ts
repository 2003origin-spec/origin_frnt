/**
 * POST /api/internal/cbt/drain — CBT room auto-submit sweep (cron).
 *
 * Auto-submits participants in rooms past their deadline (start + duration + 10s
 * grace) from their server-held drafts, then finishes those rooms. Backstop for
 * the client-side auto-submit-at-zero. Authenticated by INTERNAL_CRON_TOKEN
 * (/api/internal/* is internal in the route policy + verified in-handler).
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireInternal } from "@/server/authz";
import { sweepExpiredCbtRooms } from "@/server/cbt/cbt-attempts-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

export async function POST(request: NextRequest) {
  try {
    await requireInternal(request);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), 200);
    const result = await sweepExpiredCbtRooms(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleTeacherError(error);
  }
}

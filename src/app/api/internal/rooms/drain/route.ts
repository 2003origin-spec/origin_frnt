/**
 * GET | POST /api/internal/rooms/drain — Teacher Live Rooms auto-stop sweep (cron).
 *
 * Finalizes any room still in `in_test` past its deadline (start + duration +
 * 10s grace) that no client has read since, then broadcasts `test_ended` to any
 * still-connected clients. The common case is already handled lazily on read by
 * getRoomState; this is the safety net for fully-disconnected rooms.
 *
 * Scheduled every 5 minutes in vercel.json. GET exists because Vercel Cron
 * issues GET (same lesson as cbt/drain); POST is kept for manual triggering.
 * Auth: INTERNAL_CRON_TOKEN or Vercel's own CRON_SECRET (/api/internal/* is
 * internal in the route policy + verified in-handler).
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { publishRoomEvent } from "@/server/rooms-pubsub";
import { sweepExpiredRooms } from "@/server/study-rooms";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { sweepExpiredCbtRooms } from "@/server/cbt/cbt-attempts-service";

import { handleTeacherError } from "@/app/api/teacher/_utils";

async function drain(request: NextRequest) {
  try {
    await requireCronCaller(request);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500);
    const finalized = await sweepExpiredRooms(limit);
    const endedAt = new Date().toISOString();
    await Promise.all(
      finalized.map((roomId) => publishRoomEvent(roomId, { type: "test_ended", ended_at: endedAt })),
    );

    // Piggyback the CBT auto-submit sweep on the same (already-scheduled) drain
    // so it runs automatically without a separate cron. Best-effort + flag-gated:
    // a CBT failure must never break the study-rooms drain.
    let cbt: { roomsSwept: number; participantsSubmitted: number } | null = null;
    if (isFeatureEnabled("cbtModule")) {
      try {
        cbt = await sweepExpiredCbtRooms(limit);
      } catch (cbtError) {
        console.error("[rooms/drain] CBT sweep failed", cbtError);
      }
    }

    return NextResponse.json({ ok: true, finalized: finalized.length, cbt });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest) {
  return drain(request);
}

export async function POST(request: NextRequest) {
  return drain(request);
}

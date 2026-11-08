/**
 * POST /api/cbt-student/join — { slug, code, displayName }. Sets participant cookie.
 *
 * Four shapes, all on this one route (brand-new API child routes are avoided
 * here — see the Next-16 phantom-404 incident):
 *   • plain join                              → creates a participant;
 *   • join whose name matches an idle attempt → 409 `reclaim_available` plus the
 *     candidate list, so the student can confirm instead of silently starting a
 *     second empty attempt — which is what used to strand the first one as
 *     "absent" with no score;
 *   • { reclaimParticipantId }                → hands that attempt back;
 *   • { forceNew: true }                      → "I'm a different person".
 */

import type { NextRequest, NextResponse } from "next/server";

import { cbtJoinFailureLimiter, cbtJoinLimiter, cbtReclaimLimiter, checkRateLimit } from "@/lib/rate-limit";
import { CBT_PARTICIPANT_COOKIE, CBT_PARTICIPANT_COOKIE_OPTS } from "@/lib/cbt/participant-token";
import { joinRoom, reclaimParticipant } from "@/server/cbt/cbt-rooms-service";
import { ROOM_CODE_LOCKED_DETAIL, withRoomCodeGuard } from "@/server/cbt/room-code-guard";

import {
  cbtEnabled,
  clientIpOf,
  handleStudentError,
  notFoundWhenDisabled,
  requireJsonContentType,
  studentJson,
} from "../_utils";

export async function POST(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    if (!requireJsonContentType(request)) return studentJson({ detail: "Invalid content type." }, { status: 415 });
    const body = (await request.json().catch(() => ({}))) as {
      slug?: string;
      code?: string;
      displayName?: string;
      reclaimParticipantId?: string;
      forceNew?: boolean;
    };
    const { slug, code, displayName, reclaimParticipantId } = body;
    if (!slug || !code || !displayName) {
      return studentJson({ detail: "Room code and your name are required." }, { status: 400 });
    }

    const ipKey = `${clientIpOf(request)}:${slug}`;
    // Throughput limiter: a whole computer lab shares one NAT IP and every
    // crash-rejoin costs another slot, so this has to fit a full room. The old
    // 10-per-hour ceiling locked out the 11th student of the hour entirely.
    const limited = await checkRateLimit(cbtJoinLimiter, ipKey);
    if (limited) return limited as unknown as NextResponse;

    // Brute-force guard on the room code: every path below checks the code.
    // A correct code always gets in; only a 403 (incorrect code) spends the
    // (ip, room) budget, and once it is spent further wrong codes get 429.
    const lockedOut = () =>
      studentJson({ detail: ROOM_CODE_LOCKED_DETAIL }, { status: 429, headers: { "Retry-After": "600" } });

    if (reclaimParticipantId) {
      const reclaimLimited = await checkRateLimit(cbtReclaimLimiter, ipKey);
      if (reclaimLimited) return reclaimLimited as unknown as NextResponse;

      const reclaimed = await withRoomCodeGuard(cbtJoinFailureLimiter, ipKey, () =>
        reclaimParticipant({
          slug,
          code,
          displayName,
          participantId: reclaimParticipantId,
        }),
      );
      if (reclaimed.locked) return lockedOut();
      const resumed = reclaimed.value;
      const res = studentJson({
        resumed: true,
        studentCode: resumed.studentCode,
        roomId: resumed.roomId,
        participantId: resumed.participantId,
      });
      res.cookies.set(CBT_PARTICIPANT_COOKIE, resumed.token, CBT_PARTICIPANT_COOKIE_OPTS);
      return res;
    }

    const joined = await withRoomCodeGuard(cbtJoinFailureLimiter, ipKey, () =>
      joinRoom({
        slug,
        code,
        displayName,
        forceNew: body.forceNew === true,
      }),
    );
    if (joined.locked) return lockedOut();
    const result = joined.value;

    if (result.kind === "reclaim_available") {
      const reclaimLimited = await checkRateLimit(cbtReclaimLimiter, ipKey);
      if (reclaimLimited) return reclaimLimited as unknown as NextResponse;
      return studentJson(
        { code: "reclaim_available", roomId: result.roomId, candidates: result.candidates },
        { status: 409 },
      );
    }

    const res = studentJson({
      studentCode: result.studentCode,
      roomId: result.roomId,
      participantId: result.participant.id,
    });
    res.cookies.set(CBT_PARTICIPANT_COOKIE, result.token, CBT_PARTICIPANT_COOKIE_OPTS);
    return res;
  } catch (error) {
    return handleStudentError(error);
  }
}

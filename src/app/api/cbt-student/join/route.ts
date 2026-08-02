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
    if (!body.slug || !body.code || !body.displayName) {
      return studentJson({ detail: "Room code and your name are required." }, { status: 400 });
    }

    const ipKey = `${clientIpOf(request)}:${body.slug}`;
    // Throughput limiter: a whole computer lab shares one NAT IP and every
    // crash-rejoin costs another slot, so this has to fit a full room. The old
    // 10-per-hour ceiling locked out the 11th student of the hour entirely.
    const limited = await checkRateLimit(cbtJoinLimiter, ipKey);
    if (limited) return limited as unknown as NextResponse;

    if (body.reclaimParticipantId) {
      const reclaimLimited = await checkRateLimit(cbtReclaimLimiter, ipKey);
      if (reclaimLimited) return reclaimLimited as unknown as NextResponse;

      const resumed = await reclaimParticipant({
        slug: body.slug,
        code: body.code,
        displayName: body.displayName,
        participantId: body.reclaimParticipantId,
      });
      const res = studentJson({
        resumed: true,
        studentCode: resumed.studentCode,
        roomId: resumed.roomId,
        participantId: resumed.participantId,
      });
      res.cookies.set(CBT_PARTICIPANT_COOKIE, resumed.token, CBT_PARTICIPANT_COOKIE_OPTS);
      return res;
    }

    let result;
    try {
      result = await joinRoom({
        slug: body.slug,
        code: body.code,
        displayName: body.displayName,
        forceNew: body.forceNew === true,
      });
    } catch (error) {
      // A wrong room code is what the strict limiter actually needs to guard.
      if ((error as { status?: number })?.status === 403) {
        await checkRateLimit(cbtJoinFailureLimiter, ipKey);
      }
      throw error;
    }

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

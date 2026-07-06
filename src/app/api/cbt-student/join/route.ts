/** POST /api/cbt-student/join — { slug, code, displayName }. Sets participant cookie. */

import type { NextRequest, NextResponse } from "next/server";

import { cbtJoinLimiter, checkRateLimit } from "@/lib/rate-limit";
import { CBT_PARTICIPANT_COOKIE, CBT_PARTICIPANT_COOKIE_OPTS } from "@/lib/cbt/participant-token";
import { joinRoom } from "@/server/cbt/cbt-rooms-service";

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
    };
    if (!body.slug || !body.code || !body.displayName) {
      return studentJson({ detail: "Room code and your name are required." }, { status: 400 });
    }
    const limited = await checkRateLimit(cbtJoinLimiter, `${clientIpOf(request)}:${body.slug}`);
    if (limited) return limited as unknown as NextResponse;

    const result = await joinRoom({ slug: body.slug, code: body.code, displayName: body.displayName });
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

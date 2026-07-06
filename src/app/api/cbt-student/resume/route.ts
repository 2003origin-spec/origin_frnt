/** POST /api/cbt-student/resume — { roomCode, studentCode }. Cross-device resume. */

import type { NextRequest, NextResponse } from "next/server";

import { cbtResumeLimiter, checkRateLimit } from "@/lib/rate-limit";
import { CBT_PARTICIPANT_COOKIE, CBT_PARTICIPANT_COOKIE_OPTS } from "@/lib/cbt/participant-token";
import { resumeParticipant } from "@/server/cbt/cbt-rooms-service";

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
    const body = (await request.json().catch(() => ({}))) as { roomCode?: string; studentCode?: string };
    if (!body.roomCode || !body.studentCode) {
      return studentJson({ detail: "Room code and student ID are required." }, { status: 400 });
    }
    const limited = await checkRateLimit(cbtResumeLimiter, `${clientIpOf(request)}:${body.studentCode}`);
    if (limited) return limited as unknown as NextResponse;

    const result = await resumeParticipant({ roomCode: body.roomCode, studentCode: body.studentCode });
    if (!result) return studentJson({ detail: "No matching session found." }, { status: 404 });

    const res = studentJson({ roomId: result.roomId, participantId: result.participantId });
    res.cookies.set(CBT_PARTICIPANT_COOKIE, result.token, CBT_PARTICIPANT_COOKIE_OPTS);
    return res;
  } catch (error) {
    return handleStudentError(error);
  }
}

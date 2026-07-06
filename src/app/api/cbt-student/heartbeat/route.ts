/** POST /api/cbt-student/heartbeat — refresh presence for the current participant. */

import type { NextRequest } from "next/server";

import { recordHeartbeat, publishPresence } from "@/server/cbt/cbt-rooms-service";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function POST(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });
    const { participant, room } = resolved;
    const wasOffline = participant.status === "offline";
    await recordHeartbeat(participant.id, room.id, room.status === "in_test");
    // A returning participant should reappear in the teacher's presence promptly.
    if (wasOffline) await publishPresence(room.id, room.status);
    return studentJson({ ok: true });
  } catch (error) {
    return handleStudentError(error);
  }
}

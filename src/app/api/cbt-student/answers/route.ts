/**
 * POST /api/cbt-student/answers — autosave draft { answers, palette }.
 * Accepts navigator.sendBeacon (text/plain body), so it parses the raw text
 * rather than requiring an application/json content-type.
 */

import type { NextRequest, NextResponse } from "next/server";

import { cbtAutosaveLimiter, checkRateLimit } from "@/lib/rate-limit";
import { saveAnswers } from "@/server/cbt/cbt-attempts-service";
import type { CbtPaletteStatus, CbtStudentAnswer } from "@/lib/cbt/attempt-model";

import { cbtEnabled, handleStudentError, notFoundWhenDisabled, resolveStudent, studentJson } from "../_utils";

export async function POST(request: NextRequest) {
  if (!cbtEnabled()) return notFoundWhenDisabled();
  try {
    const resolved = await resolveStudent(request);
    if (!resolved) return studentJson({ detail: "Not in a room." }, { status: 401 });
    const { participant, room } = resolved;

    const limited = await checkRateLimit(cbtAutosaveLimiter, participant.id);
    if (limited) return limited as unknown as NextResponse;

    const raw = await request.text().catch(() => "");
    let body: {
      answers?: Record<number, CbtStudentAnswer>;
      palette?: Record<number, CbtPaletteStatus>;
      rev?: number;
      times?: Record<number, number>;
    } = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return studentJson({ detail: "Invalid body." }, { status: 400 });
    }

    // `rev` is the browser's monotonic draft counter — a save from a stale tab
    // (or a sendBeacon fired by a dying device) is rejected with 409
    // `stale_draft` rather than overwriting newer answers.
    const result = await saveAnswers(
      participant,
      room,
      body.answers ?? {},
      body.palette ?? {},
      body.rev,
      body.times,
    );
    return studentJson({ ok: true, answeredCount: result.answeredCount, rev: result.rev });
  } catch (error) {
    return handleStudentError(error);
  }
}

// audit-skip: high-frequency student autosave — writes only the caller's own
// draft to the Redis buffer (no DB mutation, no admin/state change).
/**
 * POST /api/contest/[nothing]  — contest attempt autosave.
 *   POST /api/contest/answers   body: { contestId, answers, palette, times, rev }
 *
 * The hot path 1M concurrent autosaves hit. Writes to the Redis buffer only
 * (rev-LWW), NEVER synchronously to Postgres — contest-service /v1/drain flushes
 * the buffer in batches. Authenticated student writes only their OWN draft.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1/3.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { parseJsonBody } from "@/server/http";
import { requireAuth } from "@/server/authz";
import { saveContestDraft } from "@/server/contest/contest-draft-store";
import { isActiveSession } from "@/server/contest/contest-session-registry";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const AnswersSchema = z.object({
  contestId: z.string().min(1),
  answers: z.record(z.string(), z.unknown()).optional(),
  palette: z.record(z.string(), z.unknown()).optional(),
  times: z.record(z.string(), z.unknown()).optional(),
  rev: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = AnswersSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });

    const { contestId, answers, palette, times, rev } = parsed.data;

    // Single-active-session: a stale tab/device whose session was superseded by
    // a newer one is evicted here (409) so two tabs can't clobber each other.
    if (!(await isActiveSession(contestId, ctx.userId, ctx.sessionId))) {
      return teacherJson({ detail: "session_superseded" }, { status: 409 });
    }

    const result = await saveContestDraft(contestId, ctx.userId, { answers, palette, times, rev });
    if (!result.ok) {
      return teacherJson({ detail: result.reason }, { status: result.code });
    }
    return teacherJson({ ok: true, rev: result.rev });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * GET /api/contest/paper?contestId=  — the sanitized, shared contest question
 * paper (no answer keys). Served from the immutable-paper cache (Redis +
 * single-flight); the per-user shuffle is applied client-side from a userId
 * seed, so this payload is identical for everyone and CDN/edge-cacheable.
 *
 * Registration + LIVE-state gating is enforced on the ATTEMPT/answer path; the
 * paper itself carries no answers, so exposing it to a registered viewer is
 * safe. Authenticated + contest-flag gated.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1/3.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { getContestPaper } from "@/server/contest/contest-paper-cache";
import { isRegisteredForContest } from "@/server/contest/contest-registration-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });

    // Only registered users may pull the paper.
    if (!(await isRegisteredForContest(contestId, ctx.userId))) {
      return teacherJson({ detail: "You are not registered for this contest." }, { status: 403 });
    }

    const paper = await getContestPaper(contestId);
    // The paper is immutable once published and carries no answer keys, so a
    // client may safely reuse it (e.g. a resume re-fetch) without re-hitting the
    // origin. `private` keeps it out of shared/CDN caches (the per-user
    // registration gate above must run for every viewer).
    return teacherJson({ paper }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (error) {
    return handleTeacherError(error);
  }
}

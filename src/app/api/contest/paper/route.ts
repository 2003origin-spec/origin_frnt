/**
 * GET /api/contest/paper?contestId=  — the sanitized, shared contest question
 * paper (no answer keys). Served from the immutable-paper cache (Redis +
 * single-flight); the per-user shuffle is applied client-side from a userId
 * seed, so this payload is identical for everyone and CDN/edge-cacheable.
 *
 * Gated on contest state (LIVE, or results published) AND a CONFIRMED
 * registration via `checkPaperAccess` — the paper is never served before
 * start_at or to a waitlisted user. The payload carries no answer keys and no
 * bank question ids. Authenticated + contest-flag gated.
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md Phase 1/3.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabledRuntime } from "@/server/feature-flags-runtime";
import { requireAuth } from "@/server/authz";
import { checkPaperAccess, getContestPaper } from "@/server/contest/contest-paper-cache";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

export async function GET(request: NextRequest) {
  try {
    await requireFeatureEnabledRuntime("contest");
    const ctx = await requireAuth(request);
    const contestId = new URL(request.url).searchParams.get("contestId");
    if (!contestId) return teacherJson({ detail: "contestId is required." }, { status: 400 });

    // Only confirmed registrants, and only once the contest is LIVE.
    const access = await checkPaperAccess(contestId, ctx.userId);
    if (!access.ok) return teacherJson({ detail: access.detail }, { status: access.status });

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

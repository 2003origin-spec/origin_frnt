/**
 * Assignment surface for one teacher test.
 *
 *   POST   — assign to batches as a scheduled TEST (default), or, with
 *            `action: "share_dpp"`, share it to batches as a 30-day DPP.
 *   GET    — the test's live DPP shares (drives the share dialog's
 *            "already shared" state).
 *   DELETE — revoke a DPP share (`?shareId=`).
 *
 * The DPP verbs deliberately live in this existing file rather than a new
 * `share-dpp/route.ts`: per the Next-16 phantom-404 incident
 * (`origin-nextjs16-new-route-404`, see V1/allmd/CBT_ATTEMPT_RESILIENCE_AND_
 * TEST_COMPOSITION_PLAN_2026-08-02.md §6), new capability is folded into
 * existing route files as new methods/actions. Same reason the CBT work put
 * `finalize` on the existing room route.
 *
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 3)
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { assignTestToBatches } from "@/server/workspaces/tests-service";
import {
  listTeacherDppShares,
  revokeTeacherDppShare,
  shareTestAsDpp,
} from "@/server/workspaces/teacher-dpp-service";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

type RouteContext = WorkspaceIdRouteContext & {
  params: Promise<{ workspaceId: string; testId: string }>;
};

const assignSchema = z.object({
  action: z.literal("assign").optional(),
  batchIds: z.array(z.string()).min(1),
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
});

const shareDppSchema = z.object({
  action: z.literal("share_dpp"),
  batchIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const workspaceId = await getWorkspaceId(context);
    // Authorise BEFORE touching the body — both branches need the same roles,
    // so there is no reason to parse an unauthenticated caller's JSON.
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const { testId } = await context.params;
    const body = await request.json();

    // Share-as-DPP is opt-in via `action`; every existing caller omits it and
    // keeps the original scheduled-test assignment behaviour untouched.
    if ((body as { action?: unknown })?.action === "share_dpp") {
      requireFeatureEnabled("teacherDppShare");
      const parsed = shareDppSchema.parse(body);
      const share = await shareTestAsDpp({
        actorUserId: ctx.auth.userId,
        workspaceId,
        testId,
        batchIds: parsed.batchIds,
        requestId: requestIdOf(request),
      });
      return teacherJson({ share }, { status: 201 });
    }

    requireFeatureEnabled("teacherTests");
    const parsed = assignSchema.parse(body);

    const assignments = await assignTestToBatches({
      actorUserId: ctx.auth.userId,
      workspaceId,
      testId,
      batchIds: parsed.batchIds,
      scheduledStartAt: parsed.scheduledStartAt ?? null,
      scheduledEndAt: parsed.scheduledEndAt ?? null,
      requestId: requestIdOf(request),
    });

    return teacherJson({ assignments }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    requireFeatureEnabled("teacherDppShare");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const { testId } = await context.params;
    const shares = await listTeacherDppShares(workspaceId, { testId, liveOnly: true });
    return teacherJson({ shares });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    requireFeatureEnabled("teacherDppShare");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const shareId = new URL(request.url).searchParams.get("shareId")?.trim();
    if (!shareId) {
      return teacherJson({ detail: "shareId is required." }, { status: 400 });
    }

    await revokeTeacherDppShare({
      actorUserId: ctx.auth.userId,
      workspaceId,
      shareId,
      requestId: requestIdOf(request),
    });

    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

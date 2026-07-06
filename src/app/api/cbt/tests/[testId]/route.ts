/**
 * GET    /api/cbt/tests/[testId]  — test + ordered questions
 * PATCH  /api/cbt/tests/[testId]  — update title/description/duration/status
 * DELETE /api/cbt/tests/[testId]  — delete a test
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { recordAuditEvent } from "@/server/workspaces/audit";
import {
  deleteCbtTest,
  getCbtTest,
  updateCbtTest,
  type CbtTestStatus,
} from "@/server/cbt/cbt-tests-service";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { testId } = await context.params;
    const test = await getCbtTest(ctx.cbtTeacherId, testId);
    if (!test) return teacherJson({ detail: "Test not found." }, { status: 404 });
    return teacherJson({ test });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { testId } = await context.params;
    const body = (await parseJsonBody(request)) as {
      title?: string;
      description?: string | null;
      durationMinutes?: number;
      status?: CbtTestStatus;
    };
    const test = await updateCbtTest(ctx.cbtTeacherId, testId, body);
    if (!test) return teacherJson({ detail: "Test not found." }, { status: 404 });
    if (body.status === "ready") {
      await recordAuditEvent({
        actorUserId: ctx.userId,
        workspaceId: null,
        entityType: "cbt_test",
        entityId: testId,
        action: "cbt.test_published",
        requestId: requestIdOf(request),
      });
    }
    return teacherJson({ test });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const ctx = await requireCbtTeacher(request);
    const { testId } = await context.params;
    const deleted = await deleteCbtTest(ctx.cbtTeacherId, testId);
    if (!deleted) return teacherJson({ detail: "Test not found." }, { status: 404 });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

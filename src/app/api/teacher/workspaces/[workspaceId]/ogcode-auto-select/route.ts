// audit-skip: read-only selection — writes nothing (no test/room mutation);
// the eventual POST .../tests + configure-test calls this feeds into already
// record their own audit events.
/**
 * POST /api/teacher/workspaces/{workspaceId}/ogcode-auto-select — selects OG-code
 * questions matching class/exam/subject/chapter/count (topping up from other
 * chapters in the same subject when the chosen one is short), for the room
 * "auto-build" test-builder flow. Returns raw question ids + generation
 * metadata only — no test is created here; the caller (RoomTestBuilderDrawer)
 * feeds the result through the existing POST .../tests + configure-test flow,
 * same as its manual QuestionPicker path already does. Workspace-scoped,
 * same permission model as the rest of the room test-configuration surface.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import { withStoreAsyncScoped } from "@/server/store";
import { generateOgcodeSelectionForWorkspace, type CustomTestPayload } from "@/server/assessments";

import {
  getWorkspaceId,
  handleTeacherError,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const Schema = z
  .object({
    subject: z.string().optional(),
    subjects: z.array(z.string()).optional(),
    difficulty: z.string().optional(),
    chapter: z.string().optional(),
    class_level: z.number().int().optional(),
    exam: z.string().optional(),
    // Legacy single total (optional now that per-subject counts exist).
    question_count: z.number().int().min(1).max(500).optional(),
    // Subject-wise question load: canonical subject → count (1..500). Supersedes
    // question_count. The teacher building for a room is treated as entitled to
    // every subject, so there is no scope filter here.
    subject_question_counts: z.record(z.string(), z.number().int().min(1).max(500)).optional(),
    // Per-question timer (seconds); total duration derives from it.
    seconds_per_question: z.number().int().min(30).max(300).optional(),
    duration_minutes: z.number().int().min(1).optional(),
  })
  // Require at least one way to size the test.
  .refine(
    (v) => v.question_count != null || (v.subject_question_counts && Object.keys(v.subject_question_counts).length > 0),
    { message: "Provide question_count or subject_question_counts." },
  );

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherRooms");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, ["owner", "admin", "teacher"]);
    const payload = Schema.parse(await parseJsonBody(request)) satisfies CustomTestPayload;

    const selection = await withStoreAsyncScoped(
      (store) => generateOgcodeSelectionForWorkspace(store, ctx.auth.userId, payload),
      null,
    );

    return teacherJson(selection);
  } catch (error) {
    return handleTeacherError(error);
  }
}

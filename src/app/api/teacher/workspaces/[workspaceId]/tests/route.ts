import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireWorkspaceMember } from "@/server/workspaces/authz";
import {
  createTeacherTest,
  listTeacherTests,
  type CreateTeacherTestInput,
  type TestQuestionInput,
} from "@/server/workspaces/tests-service";
import {
  listTeacherTestSources,
  listWorkspaceQuestionUsage,
  resolveTeacherTestSources,
} from "@/server/workspaces/test-sources-service";
import { getContentQuestionStoredMap } from "@/server/workspaces/test-question-resolver";

import {
  getWorkspaceId,
  handleTeacherError,
  requestIdOf,
  teacherJson,
  type WorkspaceIdRouteContext,
} from "@/app/api/teacher/_utils";

const questionSourceBankEnum = z.enum(["ogcode", "workspace_bag", "platform_content"]);

const questionInputSchema = z.object({
  position: z.number().int().min(1),
  sourceBank: questionSourceBankEnum,
  // The builder sends the inactive source's id as `null` (ogcode rows carry
  // ogcodeQuestionId, workspace_bag rows carry contentQuestionId). Accept null
  // as well as omitted; the service enforces the right id per source bank.
  ogcodeQuestionId: z.string().nullish(),
  contentQuestionId: z.string().nullish(),
  contentQuestionVersionId: z.string().nullish(),
  marks: z.number().optional().default(4),
  negativeMarks: z.number().optional().default(-1),
});

// Multi-source ("build from documents") stack. Questions are resolved
// server-side from the picked sources, so `questions` becomes optional when
// `sources` is present. This is an extra FIELD on this handler rather than a
// new child route — see the Next-16 phantom-404 incident.
const sourceInputSchema = z.object({
  kind: z.enum(["import_job", "bag_topic", "test"]),
  id: z.string().min(1),
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
});

const previewSourcesSchema = z.object({
  preview: z.literal(true),
  sources: z.array(sourceInputSchema).min(1),
});

const createTestSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    subject: z.string().optional().default("mixed"),
    chapter: z.string().optional(),
    difficulty: z.string().optional().default("medium"),
    durationMinutes: z.number().int().min(1).max(300),
    questions: z.array(questionInputSchema).optional(),
    sources: z.array(sourceInputSchema).optional(),
    selectionPolicy: z.record(z.string(), z.unknown()).optional(),
    scoringPolicy: z.record(z.string(), z.unknown()).optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((v) => (v.questions?.length ?? 0) > 0 || (v.sources?.length ?? 0) > 0, {
    message: "Provide either questions or at least one source.",
    path: ["questions"],
  });

export async function GET(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    await requireWorkspaceMember(request, workspaceId);
    const url = new URL(request.url);

    // `?view=sources` lists the documents / topics / tests a paper can be
    // stacked from. Served by this handler rather than a child route (Next-16
    // phantom-404 incident).
    if (url.searchParams.get("view") === "sources") {
      const sources = await listTeacherTestSources(workspaceId);
      const usage = await listWorkspaceQuestionUsage(
        workspaceId,
        url.searchParams.get("excludeTestId") ?? undefined,
      );
      return teacherJson({ sources, usage });
    }

    const status = url.searchParams.get("status") ?? undefined;
    const tests = await listTeacherTests(workspaceId, { status });
    return teacherJson({ tests });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest, context: WorkspaceIdRouteContext) {
  try {
    requireFeatureEnabled("teacherTests");
    const workspaceId = await getWorkspaceId(context);
    const ctx = await requireWorkspaceMember(request, workspaceId, [
      "owner", "admin", "teacher",
    ]);
    const body = await parseJsonBody(request);

    // Preview mode resolves a picked stack WITHOUT creating anything, so the
    // builder can drop the questions into its cart and let the teacher reorder,
    // re-mark and remove before saving. Handled here rather than on a child
    // route (Next-16 phantom-404 incident).
    if ((body as { preview?: unknown }).preview === true) {
      const previewInput = previewSourcesSchema.parse(body);
      const resolution = await resolveTeacherTestSources(workspaceId, previewInput.sources);
      const labels = await getContentQuestionStoredMap(
        resolution.questions.map((q) => q.contentQuestionId ?? "").filter(Boolean),
      );
      return teacherJson({
        questions: resolution.questions.map((q) => ({
          sourceBank: "workspace_bag" as const,
          id: q.contentQuestionId ?? "",
          label: labels.get(q.contentQuestionId ?? "")?.text ?? "Question",
          marks: q.marks ?? 4,
          // The picker edits a positive value; storage keeps it negative.
          negativeMarks: Math.abs(q.negativeMarks ?? -1),
        })),
        perSource: resolution.perSource,
        totalQuestions: resolution.totalQuestions,
      });
    }

    const parsed = createTestSchema.parse(body);

    // Sources win when both are sent: the teacher explicitly asked for the
    // stack, and silently preferring a stale `questions` array would build the
    // wrong paper.
    let questions: TestQuestionInput[] = parsed.questions ?? [];
    let perSource: Awaited<ReturnType<typeof resolveTeacherTestSources>>["perSource"] | undefined;
    if (parsed.sources && parsed.sources.length > 0) {
      const resolution = await resolveTeacherTestSources(workspaceId, parsed.sources);
      questions = resolution.questions;
      perSource = resolution.perSource;
    }

    const input: CreateTeacherTestInput = {
      workspaceId,
      actorUserId: ctx.auth.userId,
      createdBy: ctx.auth.userId,
      title: parsed.title,
      description: parsed.description ?? null,
      subject: parsed.subject,
      chapter: parsed.chapter ?? null,
      difficulty: parsed.difficulty,
      durationMinutes: parsed.durationMinutes,
      questions,
      selectionPolicy: parsed.selectionPolicy ?? {},
      scoringPolicy: parsed.scoringPolicy ?? {},
      settings: parsed.settings ?? {},
      requestId: requestIdOf(request),
    };

    const test = await createTeacherTest(input);
    return teacherJson({ test, perSource }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}
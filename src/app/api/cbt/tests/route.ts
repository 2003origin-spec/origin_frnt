/**
 * GET  /api/cbt/tests  — list the teacher's tests
 * POST /api/cbt/tests  — create a test
 *        body: { title, description?, durationMinutes?, shuffleQuestions? }
 *        or, to build one paper out of several documents/clusters stacked in
 *        the order they were picked:
 *        { title, durationMinutes?, shuffleQuestions?,
 *          sources: [{ kind: "import_job" | "cluster", id, marks?, negativeMarks? }] }
 *
 * The multi-source build is an extra field on this handler rather than a new
 * child route — see the Next-16 phantom-404 incident.
 */

import type { NextRequest } from "next/server";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireCbtTeacher } from "@/server/cbt/cbt-authz";
import { createCbtTest, listCbtTests } from "@/server/cbt/cbt-tests-service";
import { createTestFromSources } from "@/server/cbt/cbt-import-service";
import { parseTestSources } from "@/lib/cbt/source-stack";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const tests = await listCbtTests(ctx.cbtTeacherId);
    return teacherJson({ tests });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCbtTeacher(request);
    const body = (await parseJsonBody(request)) as {
      title?: string;
      description?: string | null;
      durationMinutes?: number;
      shuffleQuestions?: boolean;
      sources?: unknown;
    };

    const sources = parseTestSources(body.sources);
    if (sources.length > 0) {
      const result = await createTestFromSources({
        teacher: ctx.cbtTeacher,
        title: body.title ?? "",
        durationMinutes: body.durationMinutes,
        shuffleQuestions: body.shuffleQuestions === true,
        sources,
      });
      return teacherJson({ test: { id: result.testId }, ...result }, { status: 201 });
    }

    const test = await createCbtTest(ctx.cbtTeacherId, body);
    return teacherJson({ test }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

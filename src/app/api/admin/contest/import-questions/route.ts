/**
 * GET /api/admin/contest/import-questions
 *
 * Returns the admin's published contest-import questions in the builder's
 * ResolvedQuestion shape, so they can be hand-picked ("direct-attach") into a
 * contest paper before publish. Admin-only + `contest` flag. Read-only.
 */

import type { NextRequest } from "next/server";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { listContestImportBankQuestions } from "@/server/contest/contest-import-service";

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireRole(request, ["admin"]);
    const rows = await listContestImportBankQuestions(ctx.userId);
    const questions = rows.map((q) => ({
      questionId: q.id,
      subject: q.subject,
      snapshot: {
        text: q.text,
        options: q.options,
        image: q.image,
        optionImages: q.optionImages,
        correctOption: q.correctOption,
        correctOptions: q.correctOptions,
        explanation: q.explanation,
        chapter: q.chapter,
        difficulty: q.difficulty,
      },
    }));
    return teacherJson({ questions });
  } catch (error) {
    return handleTeacherError(error);
  }
}

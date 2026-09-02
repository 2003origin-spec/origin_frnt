// audit-skip: read-only per-question analytics aggregation; writes nothing.
/**
 * GET /api/admin/contest/[id]/analytics        — per-question analytics (JSON)
 * GET /api/admin/contest/[id]/analytics?format=csv — same data as a CSV download
 *
 * Per-question %-correct, mean time, discrimination, and MCQ option distribution
 * for one contest, from contest.submission_answers. Admin-only + `contest` flag.
 */

import type { NextRequest } from "next/server";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireRole } from "@/server/authz";
import { getContestQuestionAnalytics } from "@/server/contest/contest-analytics-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireFeatureEnabled("contest");
    await requireRole(request, ["admin"]);
    const { id } = await params;
    const rows = await getContestQuestionAnalytics(id);

    if (new URL(request.url).searchParams.get("format") === "csv") {
      const header = ["position", "questionId", "subject", "chapter", "type", "attempted", "correct", "percentCorrect", "avgTimeSeconds", "discrimination", "text"];
      const lines = [header.join(",")];
      for (const r of rows) {
        lines.push([
          r.position, r.questionId, r.subject, r.chapter, r.questionType,
          r.attempted, r.correct, r.percentCorrect, r.avgTimeSeconds, r.discrimination, r.text,
        ].map(csvCell).join(","));
      }
      return new Response(lines.join("\n"), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="contest-${id}-question-analytics.csv"`,
        },
      });
    }

    return teacherJson({ questions: rows });
  } catch (error) {
    return handleTeacherError(error);
  }
}

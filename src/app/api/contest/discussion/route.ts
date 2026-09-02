/**
 * GET  /api/contest/discussion?contestId=…&position=N  — list comments
 * POST /api/contest/discussion { contestId, position, body } — add a comment
 *
 * Per-question contest discussion (post-result). Authenticated (student) prefix;
 * only available once the contest's results are published.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { getUserPostgresPool } from "@/server/user-postgres";
import { addQuestionComment, listQuestionComments } from "@/server/contest/contest-discussion-service";

import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

async function resultsPublished(contestId: string): Promise<boolean> {
  const p = getUserPostgresPool();
  if (!p) return false;
  const res = await p.query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  return res.rows[0]?.status === "result_published";
}

export async function GET(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    await requireAuth(request);
    const url = new URL(request.url);
    const contestId = url.searchParams.get("contestId");
    const position = Number(url.searchParams.get("position"));
    if (!contestId || !Number.isInteger(position)) {
      return teacherJson({ detail: "contestId and position are required." }, { status: 400 });
    }
    if (!(await resultsPublished(contestId))) return teacherJson({ comments: [] });
    const comments = await listQuestionComments(contestId, position);
    return teacherJson({ comments });
  } catch (error) {
    return handleTeacherError(error);
  }
}

const PostSchema = z.object({ contestId: z.string().min(1), position: z.number().int().min(0), body: z.string().min(1).max(1000) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = PostSchema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    if (!(await resultsPublished(parsed.data.contestId))) {
      return teacherJson({ detail: "Discussion opens once results are published." }, { status: 403 });
    }
    const comment = await addQuestionComment({
      contestId: parsed.data.contestId,
      position: parsed.data.position,
      userId: ctx.userId,
      body: parsed.data.body,
    });
    return teacherJson({ comment }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

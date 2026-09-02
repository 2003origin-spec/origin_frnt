/**
 * POST /api/contest/objection { contestId, position, reason }
 * File an answer-key objection (post-result). Authenticated student prefix.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { getUserPostgresPool } from "@/server/user-postgres";
import { fileKeyObjection } from "@/server/contest/contest-objection-service";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const Schema = z.object({ contestId: z.string().min(1), position: z.number().int().min(0), reason: z.string().min(1).max(1000) });

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });
    const p = getUserPostgresPool();
    const pub = p && (await p.query(`SELECT status FROM contest.contests WHERE id = $1`, [parsed.data.contestId])).rows[0]?.status === "result_published";
    if (!pub) return teacherJson({ detail: "Objections open once results are published." }, { status: 403 });
    const objection = await fileKeyObjection({ ...parsed.data, userId: ctx.userId });
    return teacherJson({ objection }, { status: 201 });
  } catch (error) {
    return handleTeacherError(error);
  }
}

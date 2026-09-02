/**
 * POST /api/contest/proctor
 *   { contestId, action: 'presign' }        → { uploadUrl, r2Key }
 *   { contestId, action: 'register', r2Key } → records the uploaded snapshot
 *
 * Self-hosted webcam-snapshot proctoring. Authenticated student prefix; gated by
 * the contestProctoring flag. The user id comes from the session.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { requireAuth } from "@/server/authz";
import { parseJsonBody } from "@/server/http";
import { presignProctorSnapshot, registerProctorSnapshot } from "@/server/contest/contest-proctor-service";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";

const Schema = z.object({
  contestId: z.string().min(1),
  action: z.enum(["presign", "register"]),
  r2Key: z.string().max(512).optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireFeatureEnabled("contest");
    requireFeatureEnabled("contestProctoring");
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) return teacherJson({ detail: parsed.error.message }, { status: 400 });

    if (parsed.data.action === "presign") {
      const p = presignProctorSnapshot(parsed.data.contestId, ctx.userId);
      return teacherJson(p);
    }
    if (!parsed.data.r2Key) return teacherJson({ detail: "r2Key is required." }, { status: 400 });
    // Only allow registering a key inside this user's own namespace.
    if (!parsed.data.r2Key.startsWith(`contest-proctor/${parsed.data.contestId}/${ctx.userId}/`)) {
      return teacherJson({ detail: "Invalid key." }, { status: 400 });
    }
    await registerProctorSnapshot({ contestId: parsed.data.contestId, userId: ctx.userId, r2Key: parsed.data.r2Key });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

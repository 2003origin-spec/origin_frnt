/**
 * POST /api/admin/premium-access/event-mode — turn Event Mode on/off. While ON,
 * students who sign up are auto-granted Premium Pro by the registration hook, with
 * the optional `autoRevertAt` applied to those signup grants. Admin-only.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { setPremiumEventMode } from "@/server/premium-access-admin-service";

import { requirePremiumAccessAdmin } from "../_util";

const Schema = z.object({
  active: z.boolean(),
  autoRevertAt: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePremiumAccessAdmin(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const result = await setPremiumEventMode({ actorUserId: actor.userId, ...parsed.data });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

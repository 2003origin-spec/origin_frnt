/**
 * POST /api/admin/premium-access/grant — grant Premium Pro (admin_comp, all four
 * subjects) to specific students (`mode:'users'` with userIds) or to every free
 * student (`mode:'all_free'`, optionally scoped by the current search query).
 * Optional `expiresAt` sets an auto-revert time. Admin-only; CSRF at the edge.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { grantPremiumComp } from "@/server/premium-access-admin-service";

import { requirePremiumAccessAdmin } from "../_util";

const Schema = z
  .object({
    mode: z.enum(["users", "all_free"]),
    userIds: z.array(z.string().min(1)).min(1).max(500).optional(),
    query: z.string().max(200).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .refine((d) => d.mode !== "users" || (d.userIds != null && d.userIds.length > 0), {
    message: "userIds is required when mode is 'users'",
  });

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePremiumAccessAdmin(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const result = await grantPremiumComp({ actorUserId: actor.userId, ...parsed.data });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

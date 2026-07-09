/**
 * POST /api/admin/premium-access/revoke — revoke admin_comp Premium Pro from
 * specific students (`mode:'users'`) or from everyone with a comp grant
 * (`mode:'all_comp'`, optionally scoped by search query). Only touches
 * source='admin_comp' rows, so real Razorpay payers are never affected.
 * Admin-only; CSRF at the edge.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { revokePremiumComp } from "@/server/premium-access-admin-service";

import { requirePremiumAccessAdmin } from "../_util";

const Schema = z
  .object({
    mode: z.enum(["users", "all_comp"]),
    userIds: z.array(z.string().min(1)).min(1).max(500).optional(),
    query: z.string().max(200).optional(),
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
    const result = await revokePremiumComp({ actorUserId: actor.userId, ...parsed.data });
    return teacherJson(result);
  } catch (error) {
    return handleTeacherError(error);
  }
}

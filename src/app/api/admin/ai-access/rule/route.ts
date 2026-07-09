/**
 * PUT /api/admin/ai-access/rule — the single write endpoint. Body:
 *   { scopeType, scopeId, value: 'on'|'off'|'inherit' }
 * 'on'/'off' upsert both feature columns in lockstep; 'inherit' deletes the row
 * (rejected for global; doubles as orphan cleanup). All mutations flow through
 * setAiAccessRule, which validates, propagates the cache, and audits.
 * See V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4.2.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { setAiAccessRule } from "@/server/ai-access-service";

import { requireAiAccessAdmin } from "../_util";

const Schema = z
  .object({
    scopeType: z.enum(["global", "tier", "workspace", "batch", "user"]),
    scopeId: z.string().max(200),
    value: z.enum(["on", "off", "inherit"]),
  })
  .refine((d) => d.scopeType !== "tier" || d.scopeId === "free" || d.scopeId === "premium", {
    message: "tier scopeId must be 'free' or 'premium'",
  })
  .refine((d) => d.scopeType !== "global" || d.scopeId === "", {
    message: "global scopeId must be empty",
  })
  .refine((d) => ["global", "tier"].includes(d.scopeType) || d.scopeId.trim().length > 0, {
    message: "scopeId is required for workspace/batch/user scopes",
  });

export async function PUT(request: NextRequest) {
  try {
    const actor = await requireAiAccessAdmin(request);
    const parsed = Schema.safeParse(await parseJsonBody(request));
    if (!parsed.success) {
      return teacherJson({ detail: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    const result = await setAiAccessRule(actor, parsed.data);
    return teacherJson({ rule: result.rule, previous: result.previous });
  } catch (error) {
    return handleTeacherError(error);
  }
}

/**
 * GET  /api/admin/teacher-code-requests?status=pending|approved|rejected|cancelled|all
 *      → { requests, supportPhone }
 * GET  /api/admin/teacher-code-requests?view=workspaces&q=...
 *      → { workspaces }   (direct-manage: teachers/institutes + code-access state)
 * POST /api/admin/teacher-code-requests
 *      { action: "setSupportPhone", phone }                              → { supportPhone }
 *      { action: "manageWorkspace", workspaceId, op: "setQuota", quota } → { ok, displayCode, warning }
 *      { action: "manageWorkspace", workspaceId, op: "removeQuota" }     → { ok, displayCode }
 *      { action: "manageWorkspace", workspaceId, op: "revoke" }          → { ok }
 * Admin-only, gated by adminControlCenter + teacherCodeApproval.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import {
  getSupportPhone,
  listCodeAccessRequests,
  listWorkspacesForCodeAccess,
  removeWorkspaceQuota,
  revokeWorkspaceCodeAccess,
  setSupportPhone,
  setWorkspaceQuotaDirect,
} from "@/server/workspaces/code-access-admin-service";
import type { CodeRequestStatus } from "@/server/workspaces/code-access-store";

import { requireTeacherCodeAdmin } from "./_util";

const STATUSES = ["pending", "approved", "rejected", "cancelled", "all"] as const;

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setSupportPhone"),
    phone: z.string().trim().max(40).nullable(),
  }),
  z.object({
    action: z.literal("manageWorkspace"),
    workspaceId: z.string().min(1),
    op: z.enum(["setQuota", "removeQuota", "revoke"]),
    quota: z.number().int().positive().max(1_000_000).optional(),
  }),
]);

export async function GET(request: NextRequest) {
  try {
    await requireTeacherCodeAdmin(request);
    const url = new URL(request.url);

    if (url.searchParams.get("view") === "workspaces") {
      const q = url.searchParams.get("q") ?? undefined;
      return teacherJson({ workspaces: await listWorkspacesForCodeAccess(q) });
    }

    const raw = url.searchParams.get("status");
    const status = (STATUSES as readonly string[]).includes(raw ?? "")
      ? (raw as CodeRequestStatus | "all")
      : "pending";
    const [requests, supportPhone] = await Promise.all([
      listCodeAccessRequests(status),
      getSupportPhone(),
    ]);
    return teacherJson({ requests, supportPhone });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireTeacherCodeAdmin(request);
    const parsed = postSchema.parse(await parseJsonBody(request));

    if (parsed.action === "setSupportPhone") {
      const supportPhone = await setSupportPhone({
        actorUserId: admin.userId,
        phone: parsed.phone && parsed.phone.length > 0 ? parsed.phone : null,
        requestIdHeader: requestIdOf(request),
      });
      return teacherJson({ supportPhone });
    }

    // manageWorkspace
    if (parsed.op === "setQuota") {
      if (parsed.quota === undefined) {
        return teacherJson({ detail: "A quota is required." }, { status: 400 });
      }
      const result = await setWorkspaceQuotaDirect({
        actorId: admin.userId,
        workspaceId: parsed.workspaceId,
        quota: parsed.quota,
      });
      return teacherJson({ ok: true, ...result });
    }
    if (parsed.op === "removeQuota") {
      const result = await removeWorkspaceQuota({ actorId: admin.userId, workspaceId: parsed.workspaceId });
      return teacherJson({ ok: true, ...result });
    }
    await revokeWorkspaceCodeAccess({ actorId: admin.userId, workspaceId: parsed.workspaceId });
    return teacherJson({ ok: true });
  } catch (error) {
    return handleTeacherError(error);
  }
}

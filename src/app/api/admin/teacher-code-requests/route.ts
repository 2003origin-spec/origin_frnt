/**
 * GET  /api/admin/teacher-code-requests?status=pending|approved|rejected|cancelled|all
 *      → { requests, supportPhone }
 * POST /api/admin/teacher-code-requests { action: "setSupportPhone", phone }
 *      → { supportPhone }
 * Admin-only, gated by adminControlCenter + teacherCodeApproval.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, requestIdOf, teacherJson } from "@/app/api/teacher/_utils";
import {
  getSupportPhone,
  listCodeAccessRequests,
  setSupportPhone,
} from "@/server/workspaces/code-access-admin-service";
import type { CodeRequestStatus } from "@/server/workspaces/code-access-store";

import { requireTeacherCodeAdmin } from "./_util";

const STATUSES = ["pending", "approved", "rejected", "cancelled", "all"] as const;

const postSchema = z.object({
  action: z.literal("setSupportPhone"),
  phone: z.string().trim().max(40).nullable(),
});

export async function GET(request: NextRequest) {
  try {
    await requireTeacherCodeAdmin(request);
    const raw = new URL(request.url).searchParams.get("status");
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
    const supportPhone = await setSupportPhone({
      actorUserId: admin.userId,
      phone: parsed.phone && parsed.phone.length > 0 ? parsed.phone : null,
      requestIdHeader: requestIdOf(request),
    });
    return teacherJson({ supportPhone });
  } catch (error) {
    return handleTeacherError(error);
  }
}

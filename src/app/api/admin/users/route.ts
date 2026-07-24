/**
 * GET  /api/admin/users?status=all|active|revoked|deleted&q=...  → { users, resignupAllowed }
 * POST /api/admin/users { action: "setResignupAllowed", allow }   → { resignupAllowed }
 * Admin-only, gated by adminControlCenter + adminUserLifecycle.
 */

import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseJsonBody } from "@/server/http";
import { handleTeacherError, teacherJson } from "@/app/api/teacher/_utils";
import { listUsersForAdmin } from "@/server/admin/user-lifecycle-service";
import {
  getAllowDeletedIdentityResignup,
  setAllowDeletedIdentityResignup,
} from "@/server/platform-settings";

import { requireUserLifecycleAdmin } from "./_util";

const STATUSES = ["all", "active", "revoked", "deleted"] as const;

const postSchema = z.object({
  action: z.literal("setResignupAllowed"),
  allow: z.boolean(),
});

export async function GET(request: NextRequest) {
  try {
    await requireUserLifecycleAdmin(request);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status");
    const status = (STATUSES as readonly string[]).includes(rawStatus ?? "") ? (rawStatus as string) : "all";
    const query = url.searchParams.get("q") ?? undefined;
    const [users, resignupAllowed] = await Promise.all([
      listUsersForAdmin({ status, query }),
      getAllowDeletedIdentityResignup(),
    ]);
    return teacherJson({ users, resignupAllowed });
  } catch (error) {
    return handleTeacherError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireUserLifecycleAdmin(request);
    const parsed = postSchema.parse(await parseJsonBody(request));
    await setAllowDeletedIdentityResignup(parsed.allow, admin.userId);
    return teacherJson({ resignupAllowed: parsed.allow });
  } catch (error) {
    return handleTeacherError(error);
  }
}

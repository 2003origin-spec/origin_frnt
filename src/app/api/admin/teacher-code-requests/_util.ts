import type { NextRequest } from "next/server";

import { requireRole } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";

/**
 * Shared admin preamble for /api/admin/teacher-code-requests/*: admin role +
 * adminControlCenter + teacherCodeApproval. Throws AuthzError /
 * FeatureDisabledError, both mapped by handleTeacherError. CSRF is enforced at
 * the edge (middleware double-submit) via the /api/admin prefix.
 */
export async function requireTeacherCodeAdmin(request: NextRequest): Promise<{ userId: string }> {
  const ctx = await requireRole(request, ["admin"]);
  requireFeatureEnabled("adminControlCenter");
  requireFeatureEnabled("teacherCodeApproval");
  return { userId: ctx.userId };
}

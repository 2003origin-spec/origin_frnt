import type { NextRequest } from "next/server";

import { requireRole, type AuthContext } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";

/**
 * Shared admin preamble for /api/admin/users/*: admin role + adminControlCenter +
 * adminUserLifecycle. NOTE: this gates the admin ACTIONS only. The enforcement
 * (login gating + re-signup block) is unconditional in the auth handlers.
 */
export async function requireUserLifecycleAdmin(request: NextRequest): Promise<AuthContext> {
  const ctx = await requireRole(request, ["admin"]);
  requireFeatureEnabled("adminControlCenter");
  requireFeatureEnabled("adminUserLifecycle");
  return ctx;
}

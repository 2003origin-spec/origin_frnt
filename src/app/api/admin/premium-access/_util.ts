import type { NextRequest } from "next/server";

import { requireRole } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";

/** Shared admin preamble for every /api/admin/premium-access/* handler: admin
 * role + adminControlCenter + adminPremiumAccess flags. Throws AuthzError /
 * FeatureDisabledError, both mapped by handleTeacherError. CSRF is enforced at
 * the edge (middleware double-submit) because this rides the /api/admin prefix. */
export async function requirePremiumAccessAdmin(request: NextRequest): Promise<{ userId: string }> {
  const ctx = await requireRole(request, ["admin"]);
  requireFeatureEnabled("adminControlCenter");
  requireFeatureEnabled("adminPremiumAccess");
  return { userId: ctx.userId };
}

export function intParam(value: string | null, def: number, min: number, max: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

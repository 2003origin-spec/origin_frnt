/**
 * CBT teacher authorization. Defense-in-depth behind the middleware role gate:
 * every /api/cbt handler calls requireCbtTeacher, which re-checks the feature
 * flag, the cbt_teacher role, and (critically) that the caller still has an
 * ACTIVE cbt.teachers allowlist row — so removing a teacher takes effect on the
 * very next request, not just when their token expires.
 *
 * Returns the cbt.teachers row id (`cbtTeacherId`) — the tenant key that every
 * cbt.* service call must filter on. This is NOT the origin_users id.
 */

import { AuthzError, requireRole, type AuthContext } from "@/server/authz";
import { requireFeatureEnabled } from "@/lib/feature-flags";

import { findActiveCbtTeacherByUserId, type CbtTeacher } from "./cbt-teachers-service";

export type CbtTeacherContext = AuthContext & {
  /** cbt.teachers.id — the tenant key for all cbt.* queries. */
  cbtTeacherId: string;
  /** The full active allowlist row (email, import_workspace_id, …). */
  cbtTeacher: CbtTeacher;
};

export async function requireCbtTeacher(request: Request): Promise<CbtTeacherContext> {
  requireFeatureEnabled("cbtModule");
  const ctx = await requireRole(request, ["cbt_teacher"]);
  const teacher = await findActiveCbtTeacherByUserId(ctx.userId);
  if (!teacher) {
    throw new AuthzError(403, "Your CBT access is not active.");
  }
  return { ...ctx, cbtTeacherId: teacher.id, cbtTeacher: teacher };
}

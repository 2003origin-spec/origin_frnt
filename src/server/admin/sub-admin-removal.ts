/**
 * Core of `deleteSubAdmin` (admins-service.ts), written against injected DB
 * primitives so the revocation contract is unit-testable without Postgres
 * (admins-service itself is `server-only`).
 *
 * Contract: whichever way the row goes — hard DELETE, or the FK-protected
 * fallback that demotes it to `student` — the person's `auth_token_version` is
 * bumped and every live session revoked BEFORE the row changes. Their access
 * JWT still says `role: 'admin'` for up to an hour otherwise, and
 * `requireRole(["admin"])` only catches that because the version no longer
 * matches (src/server/authz.ts `assertFreshPrincipal`).
 */

import { AuthzError } from "@/server/authz";

export type SubAdminRow = { email: string; is_main_admin: boolean; role: string };

export type SubAdminRemovalDb = {
  /** `SELECT email, is_main_admin, role FROM origin_users WHERE id = $1` */
  findAdmin(id: string): Promise<SubAdminRow | null>;
  /** Hard delete. Throws when the row is FK-referenced (audit/created_by). */
  deleteUser(id: string): Promise<void>;
  /** Fallback when the delete is refused: `UPDATE origin_users SET role = 'student'`. */
  demoteToStudent(id: string): Promise<void>;
  /** `auth_token_version + 1` and revoke every live session (dbIncrementAuthTokenVersionAndRevokeSessions). */
  revokeAllSessions(id: string): Promise<void>;
};

export type SubAdminRemovalResult = { outcome: "deleted" | "demoted" };

export async function removeSubAdmin(
  db: SubAdminRemovalDb,
  id: string,
  isProtectedEmail: (email: string) => boolean,
): Promise<SubAdminRemovalResult> {
  const row = await db.findAdmin(id);
  if (!row || row.role !== "admin") throw new AuthzError(404, "Admin not found.");
  if (row.is_main_admin || isProtectedEmail(String(row.email))) {
    throw new AuthzError(403, "The main admin cannot be removed.");
  }

  // Log them out of everything first: the DELETE cascades the session rows
  // anyway, but the demote fallback does not, and the JWT keeps `role: admin`
  // on both paths until the version mismatch bites.
  await db.revokeAllSessions(id);

  try {
    await db.deleteUser(id);
    return { outcome: "deleted" };
  } catch {
    // FK-referenced (audit/created_by) — demote to student instead of leaving admin.
    await db.demoteToStudent(id);
    // Cheap and idempotent; guarantees the bump landed with the demotion even
    // if the delete attempt was interrupted after the first revoke.
    await db.revokeAllSessions(id);
    return { outcome: "demoted" };
  }
}

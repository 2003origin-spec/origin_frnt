/**
 * Admin Control Plane — admin (RBAC) management.
 *
 * Two tiers on the flat `role='admin'`: MAIN admins (configured by the
 * PLATFORM_MAIN_ADMIN_EMAIL comma-separated allowlist or `is_main_admin = true`)
 * and SUB-admins. Sub-admins have every admin capability EXCEPT managing admins;
 * only main admins can create / unassign / delete sub-admins (enforced by
 * requireMainAdmin).
 */

import "server-only";

import { AuthzError, requireRole, type AuthContext } from "@/server/authz";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureUserSchema } from "@/server/db-users";
import { createPrefixedId } from "@/server/workspaces/ids";
import { invalidateStoreCache } from "@/server/store";

const DEFAULT_MAIN_ADMIN_EMAILS = [
  "adminoffice@o3origin.com",
  "2003origin@gmail.com",
] as const;

function parseMainAdminEmails(value: string | undefined): ReadonlySet<string> {
  const emails = (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails.length > 0 ? emails : DEFAULT_MAIN_ADMIN_EMAILS);
}

const MAIN_ADMIN_EMAILS = parseMainAdminEmails(
  process.env.PLATFORM_MAIN_ADMIN_EMAIL || process.env.MAIN_ADMIN_EMAIL,
);

function isConfiguredMainAdminEmail(email: string): boolean {
  return MAIN_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  isMainAdmin: boolean;
  joinedAt: string;
};

function rowToAdmin(row: Record<string, unknown>): AdminAccount {
  const email = String(row.email ?? "");
  return {
    id: row.id as string,
    name: (row.name as string) ?? "",
    email,
    isMainAdmin: Boolean(row.is_main_admin) || isConfiguredMainAdminEmail(email),
    joinedAt: row.joined_at ? new Date(row.joined_at as string).toISOString() : new Date().toISOString(),
  };
}

/** True iff the user is the platform main admin (flag OR env-email match). */
export async function isMainAdmin(userId: string): Promise<boolean> {
  if (!isUserPostgresConfigured()) return false;
  await ensureUserSchema();
  const res = await pool().query<{ email: string; is_main_admin: boolean }>(
    `SELECT email, is_main_admin FROM origin_users WHERE id = $1 AND role = 'admin' LIMIT 1`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) return false;
  return Boolean(row.is_main_admin) || isConfiguredMainAdminEmail(String(row.email));
}

/** Admin role + main-admin guard for the admin-management surfaces. */
export async function requireMainAdmin(request: Request): Promise<AuthContext> {
  const ctx = await requireRole(request, ["admin"]);
  if (!(await isMainAdmin(ctx.userId))) {
    throw new AuthzError(403, "Only the main admin can manage admins.");
  }
  return ctx;
}

export async function listAdmins(): Promise<AdminAccount[]> {
  await ensureUserSchema();
  const res = await pool().query(
    `SELECT id, name, email, is_main_admin, joined_at
       FROM origin_users WHERE role = 'admin'
      ORDER BY is_main_admin DESC, joined_at ASC`,
  );
  return res.rows.map(rowToAdmin);
}

/**
 * Creates a sub-admin by name + email. Admin login is OTP-only (no password
 * check), so the password hash is a placeholder. Fails if an admin already
 * exists for that email.
 */
export async function createSubAdmin(input: { name: string; email: string }): Promise<AdminAccount> {
  await ensureUserSchema();
  const email = input.email.trim().toLowerCase();
  if (isConfiguredMainAdminEmail(email)) {
    throw new AuthzError(409, "That email is the main admin.");
  }
  const id = createPrefixedId("user");
  const res = await pool().query(
    `INSERT INTO origin_users (id, name, email, password_hash, role, is_onboarded, is_main_admin)
     VALUES ($1, $2, $3, 'otp-only-no-password', 'admin', TRUE, FALSE)
     ON CONFLICT (email, role) DO NOTHING
     RETURNING id, name, email, is_main_admin, joined_at`,
    [id, input.name.trim() || "Sub-admin", email],
  );
  if (!res.rows[0]) {
    throw new AuthzError(409, "An admin with this email already exists.");
  }
  // Reflect the direct-SQL insert in the legacy store cache immediately.
  invalidateStoreCache();
  return rowToAdmin(res.rows[0]);
}

/** Unassigns / deletes a sub-admin. The main admin cannot be removed. */
export async function deleteSubAdmin(id: string): Promise<void> {
  await ensureUserSchema();
  const res = await pool().query<{ email: string; is_main_admin: boolean; role: string }>(
    `SELECT email, is_main_admin, role FROM origin_users WHERE id = $1`,
    [id],
  );
  const row = res.rows[0];
  if (!row || row.role !== "admin") throw new AuthzError(404, "Admin not found.");
  if (row.is_main_admin || isConfiguredMainAdminEmail(String(row.email))) {
    throw new AuthzError(403, "The main admin cannot be removed.");
  }
  try {
    await pool().query(`DELETE FROM origin_users WHERE id = $1`, [id]);
  } catch {
    // FK-referenced (audit/created_by) — demote to student instead of leaving admin.
    await pool().query(`UPDATE origin_users SET role = 'student' WHERE id = $1`, [id]);
  }
  // Drop the legacy store cache so the next read re-hydrates from Postgres and a
  // stale cached store can't re-persist this row via upsertUsers on the next write.
  invalidateStoreCache();
}

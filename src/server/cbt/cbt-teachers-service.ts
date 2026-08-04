/**
 * CBT teacher allowlist service. `cbt.teachers` IS the allowlist: only emails
 * with an `active` row here may log into /cbt. All reads/writes stay inside the
 * cbt.* schema (plus the shared session-revocation helper on removal); zero
 * joins into Origin student/analytics data.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import { dbIncrementAuthTokenVersionAndRevokeSessions } from "@/server/db-users";

import { ensureCbtSchema } from "./cbt-schema";
import { cbtId } from "./ids";

export type CbtTeacherStatus = "active" | "disabled";

export type CbtTeacher = {
  id: string;
  userId: string | null;
  email: string;
  displayName: string | null;
  logo: string | null;
  status: CbtTeacherStatus;
  importWorkspaceId: string | null;
  /**
   * Premium add-on: may this teacher publish shareable participant report
   * cards? Admin-controlled, FALSE for every teacher until an admin turns it
   * on, and re-checked on every report request so revoking is instant.
   */
  reportCardsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CbtUsageStats = {
  activeTeachers: number;
  totalTeachers: number;
  totalQuestions: number;
  totalTests: number;
  totalRooms: number;
  totalParticipants: number;
};

const TEACHER_COLUMNS = `id, user_id, email, display_name, logo, status, import_workspace_id,
  report_cards_enabled, created_at, updated_at`;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function mapTeacher(row: Record<string, unknown>): CbtTeacher {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : null,
    email: String(row.email),
    displayName: row.display_name ? String(row.display_name) : null,
    logo: row.logo ? String(row.logo) : null,
    status: row.status === "disabled" ? "disabled" : "active",
    importWorkspaceId: row.import_workspace_id ? String(row.import_workspace_id) : null,
    reportCardsEnabled: row.report_cards_enabled === true,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeCbtEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function listCbtTeachers(): Promise<CbtTeacher[]> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${TEACHER_COLUMNS} FROM cbt.teachers ORDER BY created_at DESC`,
  );
  return res.rows.map(mapTeacher);
}

/**
 * Finds an ACTIVE allowlisted teacher by email. Used by the OTP flow (Phase 3)
 * and by requireCbtTeacher (Phase 4) as the source of truth for eligibility.
 */
export async function findActiveCbtTeacherByEmail(email: string): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${TEACHER_COLUMNS} FROM cbt.teachers WHERE email = $1 AND status = 'active'`,
    [normalizeCbtEmail(email)],
  );
  return res.rows[0] ? mapTeacher(res.rows[0]) : null;
}

/**
 * Finds an ACTIVE allowlisted teacher by their linked origin_users id. Source
 * of truth for requireCbtTeacher (Phase 4+): a disabled/removed teacher's
 * session fails here even before their tokens expire.
 */
export async function findActiveCbtTeacherByUserId(userId: string): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `SELECT ${TEACHER_COLUMNS} FROM cbt.teachers WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
  return res.rows[0] ? mapTeacher(res.rows[0]) : null;
}

/** Set (or clear) the institute logo shown on the student thank-you screen. */
export async function updateCbtTeacherLogo(teacherId: string, logoUrl: string | null): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `UPDATE cbt.teachers SET logo = $2, updated_at = NOW() WHERE id = $1 RETURNING ${TEACHER_COLUMNS}`,
    [teacherId, logoUrl],
  );
  return res.rows[0] ? mapTeacher(res.rows[0]) : null;
}

const MAX_DISPLAY_NAME_LENGTH = 80;

/**
 * Set (or clear) the institute display name shown under the logo on the student
 * thank-you screen. Blank clears it back to NULL, which renders logo-only.
 */
export async function updateCbtTeacherDisplayName(
  teacherId: string,
  displayName: string | null,
): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const trimmed = (displayName ?? "").trim();
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    const err = new Error(`Institute name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`) as Error & {
      status: number;
    };
    err.status = 400;
    throw err;
  }
  const res = await pool().query(
    `UPDATE cbt.teachers SET display_name = $2, updated_at = NOW() WHERE id = $1 RETURNING ${TEACHER_COLUMNS}`,
    [teacherId, trimmed || null],
  );
  return res.rows[0] ? mapTeacher(res.rows[0]) : null;
}

/**
 * Admin switch for the premium report-card add-on.
 *
 * Turning it OFF does not touch any room's own publish flag — it simply makes
 * every report request for that teacher 404, so re-enabling restores exactly
 * what the teacher had published before.
 */
export async function setCbtTeacherReportCards(
  teacherId: string,
  enabled: boolean,
): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const res = await pool().query(
    `UPDATE cbt.teachers SET report_cards_enabled = $2, updated_at = NOW()
       WHERE id = $1 RETURNING ${TEACHER_COLUMNS}`,
    [teacherId, enabled],
  );
  return res.rows[0] ? mapTeacher(res.rows[0]) : null;
}

export async function addCbtTeacher(input: {
  email: string;
  displayName?: string | null;
  adminUserId: string | null;
}): Promise<CbtTeacher> {
  await ensureCbtSchema();
  const email = normalizeCbtEmail(input.email);
  if (!EMAIL_RE.test(email)) {
    const err = new Error("A valid email address is required.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  const displayName = input.displayName?.trim() || null;
  // Lowercase upsert: re-adding a previously-disabled teacher re-activates them.
  const res = await pool().query(
    `INSERT INTO cbt.teachers (id, email, display_name, status, added_by_admin_id)
       VALUES ($1, $2, $3, 'active', $4)
     ON CONFLICT (email) DO UPDATE SET
       status = 'active',
       display_name = COALESCE(EXCLUDED.display_name, cbt.teachers.display_name),
       updated_at = NOW()
     RETURNING ${TEACHER_COLUMNS}`,
    [cbtId("cbtt"), email, displayName, input.adminUserId],
  );
  return mapTeacher(res.rows[0]);
}

/**
 * Disables a teacher (does NOT delete the row or the origin_users account) and,
 * if they had ever logged in, revokes every live session: bumps
 * auth_token_version (invalidates outstanding access tokens on next hydration)
 * and clears their origin_auth_sessions rows (stops refresh).
 */
export async function removeCbtTeacher(input: {
  id?: string;
  email?: string;
}): Promise<CbtTeacher | null> {
  await ensureCbtSchema();
  const client: PoolClient = await pool().connect();
  try {
    let res;
    if (input.id) {
      res = await client.query(
        `UPDATE cbt.teachers SET status = 'disabled', updated_at = NOW()
           WHERE id = $1 RETURNING ${TEACHER_COLUMNS}`,
        [input.id],
      );
    } else if (input.email) {
      res = await client.query(
        `UPDATE cbt.teachers SET status = 'disabled', updated_at = NOW()
           WHERE email = $1 RETURNING ${TEACHER_COLUMNS}`,
        [normalizeCbtEmail(input.email)],
      );
    } else {
      const err = new Error("An id or email is required.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    if (!res.rows[0]) return null;
    const teacher = mapTeacher(res.rows[0]);
    if (teacher.userId) {
      // Live session revocation (defense-in-depth: requireCbtTeacher also
      // re-checks status per request in Phase 4).
      await dbIncrementAuthTokenVersionAndRevokeSessions(teacher.userId);
    }
    return teacher;
  } finally {
    client.release();
  }
}

/**
 * Links a teacher's origin_users id onto their allowlist row on first login.
 * No-op if the email is not (or no longer) an active allowlist entry.
 */
export async function linkCbtTeacherUser(email: string, userId: string): Promise<void> {
  await ensureCbtSchema();
  await pool().query(
    `UPDATE cbt.teachers SET user_id = $1, updated_at = NOW()
       WHERE email = $2 AND status = 'active'`,
    [userId, normalizeCbtEmail(email)],
  );
}

export async function getCbtUsageStats(): Promise<CbtUsageStats> {
  await ensureCbtSchema();
  const res = await pool().query(`
    SELECT
      (SELECT COUNT(*) FROM cbt.teachers WHERE status = 'active') AS active_teachers,
      (SELECT COUNT(*) FROM cbt.teachers) AS total_teachers,
      (SELECT COUNT(*) FROM cbt.questions) AS total_questions,
      (SELECT COUNT(*) FROM cbt.tests) AS total_tests,
      (SELECT COUNT(*) FROM cbt.rooms) AS total_rooms,
      (SELECT COUNT(*) FROM cbt.room_participants) AS total_participants
  `);
  const row = res.rows[0] ?? {};
  return {
    activeTeachers: Number(row.active_teachers ?? 0),
    totalTeachers: Number(row.total_teachers ?? 0),
    totalQuestions: Number(row.total_questions ?? 0),
    totalTests: Number(row.total_tests ?? 0),
    totalRooms: Number(row.total_rooms ?? 0),
    totalParticipants: Number(row.total_participants ?? 0),
  };
}

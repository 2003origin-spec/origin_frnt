/**
 * Row-level store for Feature A — admin-gated teacher code access. Handles the
 * workspace "live grant" columns, the connected-student count used for quota
 * enforcement, and the app.teacher_code_requests request/approval ledger.
 * Orchestration (audit, code issue/revoke, AI rule) lives in code-access-service.
 * See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import type { Pool, PoolClient } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureCodeAccessSchema } from "./code-access-schema";
import { ensureEnrollmentSchema } from "./enrollment-schema";
import { ensureWorkspaceSchema } from "./schema";
import { createCodeRequestId } from "./ids";
import type { CodeAccessStatus } from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Typed error for the code-access surface (mapped to HTTP by handleTeacherError). */
export class CodeAccessError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "CodeAccessError";
  }
}

export type CodeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type TeacherCodeRequest = {
  id: string;
  workspaceId: string;
  requestedBy: string;
  requestedStudentCount: number;
  aiAccess: boolean;
  status: CodeRequestStatus;
  grantedQuota: number | null;
  grantedCodeId: string | null;
  adminNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CodeRequestWithContext = TeacherCodeRequest & {
  workspaceName: string;
  workspaceType: "personal" | "institute";
  ownerName: string | null;
  ownerEmail: string | null;
  /** Distinct students currently occupying a seat (status unassigned|active). */
  connectedStudents: number;
  currentQuota: number | null;
  codeAccessStatus: CodeAccessStatus;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRequest(row: any): TeacherCodeRequest {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    requestedBy: row.requested_by,
    requestedStudentCount: Number(row.requested_student_count),
    aiAccess: Boolean(row.ai_access),
    status: row.status as CodeRequestStatus,
    grantedQuota: row.granted_quota === null || row.granted_quota === undefined ? null : Number(row.granted_quota),
    grantedCodeId: (row.granted_code_id as string | null) ?? null,
    adminNote: (row.admin_note as string | null) ?? null,
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// ─── Workspace grant columns ────────────────────────────────────────────────

export type WorkspaceCodeAccessPatch = {
  codeAccessStatus?: CodeAccessStatus;
  studentQuota?: number | null;
  codeAiAccess?: boolean | null;
};

/** Updates the workspace's live code-access columns. No-op patch is a no-op. */
export async function setWorkspaceCodeAccess(
  workspaceId: string,
  patch: WorkspaceCodeAccessPatch,
  client?: PoolClient,
): Promise<void> {
  await ensureWorkspaceSchema();
  const runner = client ?? pool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (patch.codeAccessStatus !== undefined) {
    fields.push(`code_access_status = $${i++}`);
    values.push(patch.codeAccessStatus);
  }
  if (patch.studentQuota !== undefined) {
    fields.push(`student_quota = $${i++}`);
    values.push(patch.studentQuota);
  }
  if (patch.codeAiAccess !== undefined) {
    fields.push(`code_ai_access = $${i++}`);
    values.push(patch.codeAiAccess);
  }
  if (fields.length === 0) return;
  values.push(workspaceId);
  await runner.query(
    `UPDATE app.teacher_workspaces SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
    values,
  );
}

/**
 * Distinct students currently occupying a seat in the workspace — status
 * unassigned or active. 'suspended'/'left' free a slot (D3). Accepts a client so
 * the redeem path can count inside the same locked transaction (A4).
 */
export async function countConnectedStudents(
  workspaceId: string,
  client?: PoolClient,
): Promise<number> {
  await ensureEnrollmentSchema();
  const runner = client ?? pool();
  const res = await runner.query(
    `SELECT COUNT(DISTINCT student_id)::int AS n
       FROM app.workspace_student_enrollments
      WHERE workspace_id = $1 AND status IN ('unassigned', 'active')`,
    [workspaceId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

// ─── Request ledger ──────────────────────────────────────────────────────────

/**
 * Inserts a pending code-access request. The partial unique index
 * uq_teacher_code_request_pending enforces at most one open request per
 * workspace; a duplicate raises CodeAccessError(409).
 */
export async function insertCodeRequest(input: {
  workspaceId: string;
  requestedBy: string;
  requestedStudentCount: number;
  aiAccess: boolean;
}): Promise<TeacherCodeRequest> {
  await ensureCodeAccessSchema();
  const id = createCodeRequestId();
  try {
    const res = await pool().query(
      `INSERT INTO app.teacher_code_requests
         (id, workspace_id, requested_by, requested_student_count, ai_access, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [id, input.workspaceId, input.requestedBy, input.requestedStudentCount, input.aiAccess],
    );
    return rowToRequest(res.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new CodeAccessError(409, "You already have a pending code-access request.");
    }
    throw error;
  }
}

export async function getPendingRequestForWorkspace(
  workspaceId: string,
): Promise<TeacherCodeRequest | null> {
  await ensureCodeAccessSchema();
  const res = await pool().query(
    `SELECT * FROM app.teacher_code_requests
      WHERE workspace_id = $1 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1`,
    [workspaceId],
  );
  return res.rows[0] ? rowToRequest(res.rows[0]) : null;
}

export async function getCodeRequestById(id: string): Promise<TeacherCodeRequest | null> {
  await ensureCodeAccessSchema();
  const res = await pool().query(`SELECT * FROM app.teacher_code_requests WHERE id = $1`, [id]);
  return res.rows[0] ? rowToRequest(res.rows[0]) : null;
}

/** Admin console list: requests joined with workspace + owner + live counts. */
export async function listCodeRequestsWithContext(input: {
  status?: CodeRequestStatus | "all";
  limit?: number;
}): Promise<CodeRequestWithContext[]> {
  await ensureCodeAccessSchema();
  const params: unknown[] = [];
  let where = "";
  if (input.status && input.status !== "all") {
    params.push(input.status);
    where = `WHERE r.status = $${params.length}`;
  }
  params.push(Math.min(Math.max(input.limit ?? 100, 1), 500));
  const res = await pool().query(
    `SELECT r.*, w.display_name AS workspace_name, w.workspace_type,
            w.student_quota AS current_quota, w.code_access_status,
            u.name AS owner_name, u.email AS owner_email,
            (SELECT COUNT(DISTINCT e.student_id)::int
               FROM app.workspace_student_enrollments e
              WHERE e.workspace_id = w.id AND e.status IN ('unassigned','active')) AS connected_students
       FROM app.teacher_code_requests r
       JOIN app.teacher_workspaces w ON w.id = r.workspace_id
       LEFT JOIN origin_users u ON u.id = w.owner_user_id
       ${where}
      ORDER BY (r.status = 'pending') DESC, r.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.rows.map((row: any) => ({
    ...rowToRequest(row),
    workspaceName: row.workspace_name,
    workspaceType: row.workspace_type,
    ownerName: row.owner_name ?? null,
    ownerEmail: row.owner_email ?? null,
    connectedStudents: Number(row.connected_students ?? 0),
    currentQuota: row.current_quota === null || row.current_quota === undefined ? null : Number(row.current_quota),
    codeAccessStatus: (row.code_access_status as CodeAccessStatus) ?? "legacy",
  }));
}

/** Records an admin decision (approve/reject) on a pending request. */
export async function updateCodeRequestDecision(input: {
  id: string;
  status: "approved" | "rejected";
  grantedQuota?: number | null;
  grantedCodeId?: string | null;
  adminNote?: string | null;
  decidedBy: string;
  client?: PoolClient;
}): Promise<TeacherCodeRequest | null> {
  const runner = input.client ?? pool();
  const res = await runner.query(
    `UPDATE app.teacher_code_requests
        SET status = $2, granted_quota = $3, granted_code_id = $4,
            admin_note = $5, decided_by = $6, decided_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [input.id, input.status, input.grantedQuota ?? null, input.grantedCodeId ?? null, input.adminNote ?? null, input.decidedBy],
  );
  return res.rows[0] ? rowToRequest(res.rows[0]) : null;
}

export type WorkspaceCodeAccessRow = {
  workspaceId: string;
  workspaceName: string;
  workspaceType: "personal" | "institute";
  ownerName: string | null;
  ownerEmail: string | null;
  codeAccessStatus: CodeAccessStatus;
  studentQuota: number | null;
  activeCode: string | null;
  connectedStudents: number;
};

/**
 * Admin "manage a teacher directly" search: teacher/institute workspaces with
 * their live code-access state (code, quota, connected count). Powers setting a
 * quota on a grandfathered/legacy teacher who has no pending request.
 */
export async function searchWorkspaceCodeAccess(input: {
  query?: string;
  limit?: number;
}): Promise<WorkspaceCodeAccessRow[]> {
  await ensureCodeAccessSchema();
  const params: unknown[] = [];
  let filter = "";
  if (input.query && input.query.trim()) {
    params.push(`%${input.query.trim()}%`);
    filter = `WHERE (w.display_name ILIKE $1 OR u.name ILIKE $1 OR u.email ILIKE $1)`;
  }
  params.push(Math.min(Math.max(input.limit ?? 25, 1), 100));
  const res = await pool().query(
    `SELECT w.id, w.display_name, w.workspace_type, w.code_access_status, w.student_quota,
            u.name AS owner_name, u.email AS owner_email,
            (SELECT c.display_code FROM app.workspace_codes c
              WHERE c.workspace_id = w.id AND c.code_type = 'student_join' AND c.status = 'active'
              LIMIT 1) AS active_code,
            (SELECT COUNT(DISTINCT e.student_id)::int FROM app.workspace_student_enrollments e
              WHERE e.workspace_id = w.id AND e.status IN ('unassigned','active')) AS connected
       FROM app.teacher_workspaces w
       LEFT JOIN origin_users u ON u.id = w.owner_user_id
       ${filter}
      ORDER BY w.created_at DESC
      LIMIT $${params.length}`,
    params,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.rows.map((row: any) => ({
    workspaceId: row.id,
    workspaceName: row.display_name,
    workspaceType: row.workspace_type,
    ownerName: row.owner_name ?? null,
    ownerEmail: row.owner_email ?? null,
    codeAccessStatus: (row.code_access_status as CodeAccessStatus) ?? "legacy",
    studentQuota: row.student_quota === null || row.student_quota === undefined ? null : Number(row.student_quota),
    activeCode: row.active_code ?? null,
    connectedStudents: Number(row.connected ?? 0),
  }));
}

/**
 * Safety-net query for the drain: workspaces whose active student_join code
 * should already be disabled because the connected count has reached the quota.
 * The inline redeem enforcement (join.ts) is the primary path; this catches the
 * lazy cases (a connected student re-redeemed at exactly-full, or an admin
 * lowered the quota below the current count).
 */
export async function listQuotaFilledActiveCodes(): Promise<
  { workspaceId: string; codeId: string; quota: number; connected: number }[]
> {
  await ensureCodeAccessSchema();
  const res = await pool().query(
    `SELECT w.id AS workspace_id, c.id AS code_id, w.student_quota AS quota,
            (SELECT COUNT(DISTINCT e.student_id)::int
               FROM app.workspace_student_enrollments e
              WHERE e.workspace_id = w.id AND e.status IN ('unassigned','active')) AS connected
       FROM app.teacher_workspaces w
       JOIN app.workspace_codes c
         ON c.workspace_id = w.id AND c.status = 'active' AND c.code_type = 'student_join'
      WHERE w.student_quota IS NOT NULL
        AND (SELECT COUNT(DISTINCT e.student_id)
               FROM app.workspace_student_enrollments e
              WHERE e.workspace_id = w.id AND e.status IN ('unassigned','active')) >= w.student_quota`,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.rows.map((row: any) => ({
    workspaceId: row.workspace_id,
    codeId: row.code_id,
    quota: Number(row.quota),
    connected: Number(row.connected),
  }));
}

/** Teacher cancels their own pending request. Returns the cancelled row or null. */
export async function cancelPendingRequest(
  workspaceId: string,
  requestId: string,
): Promise<TeacherCodeRequest | null> {
  await ensureCodeAccessSchema();
  const res = await pool().query(
    `UPDATE app.teacher_code_requests
        SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND workspace_id = $2 AND status = 'pending'
      RETURNING *`,
    [requestId, workspaceId],
  );
  return res.rows[0] ? rowToRequest(res.rows[0]) : null;
}

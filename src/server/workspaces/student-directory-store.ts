/**
 * Teacher student directory — searchable, filterable, sortable, paginated roster.
 * (Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md §4.1, D3)
 *
 * POOL: USER only (`app.workspace_student_enrollments` ⋈ `origin_users` ⋈
 * `app.batch_members` ⋈ `app.batches`). Performance metrics live in the OGCODE
 * database and are merged by workspace-analytics-service.
 *
 * SEARCH: Postgres `pg_trgm`-accelerated ILIKE. The GIN index on
 * `LOWER(origin_users.name)` already exists — `ensureSocialSchema` creates it for
 * student search — so name lookups are index-backed with no new migration.
 *
 * Search sits behind `StudentSearchProvider` for the same reason
 * participant-search.ts does: if institute-wide search ever outgrows Postgres,
 * a managed Elasticsearch/OpenSearch provider drops in here and neither the
 * route nor the UI changes. A dedicated search cluster is not justified for a
 * roster measured in thousands of rows.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  clampPage,
  clampPageSize,
  escapeLikePattern,
  normalizeSearchTerm,
  type SortDirection,
  type StudentSortKey,
} from "@/lib/teacher-analytics";

import { ensureEnrollmentSchema } from "./enrollment-schema";
import type { EnrollmentStatus } from "./types";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Sort keys that map to a real USER-pool column and can be ordered in SQL. */
const DB_SORT_COLUMNS: Partial<Record<StudentSortKey, string>> = {
  name: "LOWER(u.name)",
  enrolledAt: "e.enrolled_at",
  streak: "u.streak",
  studyTime: "u.total_study_time",
};

/**
 * Cap on rows scanned when sorting by a cross-pool metric (mean % / attempts),
 * which cannot be ordered in SQL and must be sorted in app code (ledger #12).
 */
const MAX_METRIC_SORT_SCAN = 2000;

/**
 * SQL predicate matching an enrollment against a list of statuses.
 *
 * `app.workspace_student_enrollments.status` is the ENUM `app.enrollment_status`,
 * **not** text — so the bind parameter must be cast to `app.enrollment_status[]`.
 * Casting it to `text[]` instead makes Postgres reject the whole query with
 * `operator does not exist: app.enrollment_status = text`, which surfaces as an
 * empty directory rather than an error. Casting the *column* to text would work
 * too but would forfeit idx_workspace_enrollments_workspace_status.
 *
 * Callers MUST whitelist the values first (the enum cast rejects unknown labels).
 */
export function enrollmentStatusPredicate(paramIndex: number): string {
  return `e.status = ANY($${paramIndex}::app.enrollment_status[])`;
}

export type DirectoryStudentRow = {
  studentId: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  studentClass: string | null;
  /** Denormalised streak mirror on origin_users. */
  streak: number;
  /** MINUTES (see gamification.updateUserStudyTime). */
  totalStudyTimeMinutes: number;
  status: EnrollmentStatus;
  enrolledAt: string;
  batches: Array<{ id: string; name: string }>;
};

export type StudentDirectoryQuery = {
  workspaceId: string;
  /** Raw search box value; normalised + LIKE-escaped internally. */
  query?: string | null;
  batchId?: string | null;
  /**
   * Enrollment statuses to include. Empty/absent means every status — a LIST
   * rather than a single value because the directory's "Suspended / Left" tab
   * is genuinely two statuses, and filtering that client-side would break
   * pagination totals.
   */
  statuses?: readonly EnrollmentStatus[] | null;
  sort: StudentSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

export type StudentDirectoryPage = {
  rows: DirectoryStudentRow[];
  total: number;
  page: number;
  pageSize: number;
  /**
   * True when `rows` holds EVERY matching student rather than one page —
   * the caller must merge cross-pool metrics, sort, and slice itself. Set when
   * the requested sort key is not a USER-pool column.
   */
  requiresMetricSort: boolean;
};

export interface StudentSearchProvider {
  search(input: StudentDirectoryQuery): Promise<StudentDirectoryPage>;
}

const postgresStudentSearch: StudentSearchProvider = {
  search: (input) => searchStudentsPostgres(input),
};

/** Swap for an Elasticsearch-backed provider if search ever outgrows Postgres. */
export function getStudentSearchProvider(): StudentSearchProvider {
  return postgresStudentSearch;
}

async function searchStudentsPostgres(
  input: StudentDirectoryQuery,
): Promise<StudentDirectoryPage> {
  await ensureEnrollmentSchema();

  const page = clampPage(input.page);
  const pageSize = clampPageSize(input.pageSize);
  const params: unknown[] = [input.workspaceId];
  const where: string[] = ["e.workspace_id = $1"];

  if (input.statuses && input.statuses.length > 0) {
    params.push([...input.statuses]);
    where.push(enrollmentStatusPredicate(params.length));
  }

  if (input.batchId) {
    params.push(input.batchId);
    // EXISTS rather than a JOIN: a student in several batches must not produce
    // duplicate directory rows (ledger #6).
    where.push(`EXISTS (
      SELECT 1 FROM app.batch_members m
       WHERE m.workspace_id = e.workspace_id
         AND m.student_id = e.student_id
         AND m.batch_id = $${params.length}
         AND m.status = 'active'
    )`);
  }

  const term = normalizeSearchTerm(input.query);
  if (term) {
    // Contains-match on the LOWER(name) trigram index; email and id are exact
    // enough that a prefix/contains ILIKE is fine without their own index.
    params.push(`%${escapeLikePattern(term.toLowerCase())}%`);
    const pattern = `$${params.length}`;
    where.push(`(
      LOWER(u.name) LIKE ${pattern} ESCAPE '\\'
      OR LOWER(u.email) LIKE ${pattern} ESCAPE '\\'
      OR LOWER(e.student_id) LIKE ${pattern} ESCAPE '\\'
    )`);
  }

  const sortColumn = DB_SORT_COLUMNS[input.sort];
  const requiresMetricSort = !sortColumn;
  const direction = input.direction === "desc" ? "DESC" : "ASC";
  // Whitelisted column + literal direction only — no user input is interpolated.
  const orderBy = sortColumn
    ? `${sortColumn} ${direction} NULLS LAST, e.student_id ASC`
    : `LOWER(u.name) ASC, e.student_id ASC`;

  let limitClause: string;
  if (requiresMetricSort) {
    limitClause = `LIMIT ${MAX_METRIC_SORT_SCAN}`;
  } else {
    params.push(pageSize, (page - 1) * pageSize);
    limitClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
  }

  const result = await pool().query(
    `SELECT e.student_id, e.status, e.enrolled_at,
            u.name, u.email, u.avatar, u.student_class, u.streak, u.total_study_time,
            COUNT(*) OVER()::int AS total_count
       FROM app.workspace_student_enrollments e
       INNER JOIN origin_users u ON u.id = e.student_id
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      ${limitClause}`,
    params,
  );

  const rows: DirectoryStudentRow[] = result.rows.map((row) => ({
    studentId: row.student_id as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    avatar: (row.avatar as string | null) ?? null,
    studentClass: (row.student_class as string | null) ?? null,
    streak: Number(row.streak) || 0,
    totalStudyTimeMinutes: Number(row.total_study_time) || 0,
    status: row.status as EnrollmentStatus,
    enrolledAt: new Date(row.enrolled_at as string).toISOString(),
    batches: [],
  }));

  const total = Number(result.rows[0]?.total_count) || 0;
  await attachBatchChips(input.workspaceId, rows);

  return { rows, total, page, pageSize, requiresMetricSort };
}

/**
 * Fill in each row's real batch memberships — replacing the hash-derived
 * placeholder chips the directory used to render (plan D5). One query for the
 * whole page.
 */
async function attachBatchChips(
  workspaceId: string,
  rows: DirectoryStudentRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.studentId);
  const result = await pool().query(
    `SELECT m.student_id, b.id AS batch_id, b.name AS batch_name
       FROM app.batch_members m
       INNER JOIN app.batches b ON b.id = m.batch_id
      WHERE m.workspace_id = $1
        AND m.student_id = ANY($2::text[])
        AND m.status = 'active'
      ORDER BY b.name ASC`,
    [workspaceId, ids],
  );
  const byStudent = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of result.rows) {
    const list = byStudent.get(row.student_id as string) ?? [];
    list.push({ id: row.batch_id as string, name: row.batch_name as string });
    byStudent.set(row.student_id as string, list);
  }
  for (const row of rows) {
    row.batches = byStudent.get(row.studentId) ?? [];
  }
}

/** Roster identity for one student, scoped to the workspace (the 360° header). */
export async function getDirectoryStudent(
  workspaceId: string,
  studentId: string,
): Promise<DirectoryStudentRow | null> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT e.student_id, e.status, e.enrolled_at,
            u.name, u.email, u.avatar, u.student_class, u.streak, u.total_study_time
       FROM app.workspace_student_enrollments e
       INNER JOIN origin_users u ON u.id = e.student_id
      WHERE e.workspace_id = $1 AND e.student_id = $2
      LIMIT 1`,
    [workspaceId, studentId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const student: DirectoryStudentRow = {
    studentId: row.student_id as string,
    name: (row.name as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    avatar: (row.avatar as string | null) ?? null,
    studentClass: (row.student_class as string | null) ?? null,
    streak: Number(row.streak) || 0,
    totalStudyTimeMinutes: Number(row.total_study_time) || 0,
    status: row.status as EnrollmentStatus,
    enrolledAt: new Date(row.enrolled_at as string).toISOString(),
    batches: [],
  };
  await attachBatchChips(workspaceId, [student]);
  return student;
}

/**
 * Every active batch membership in the workspace as `studentId → batchId[]`.
 * One query, so overview tables can label students with their batches without
 * an N+1 per row.
 */
export async function getWorkspaceBatchMemberships(
  workspaceId: string,
): Promise<Map<string, string[]>> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT student_id, batch_id
       FROM app.batch_members
      WHERE workspace_id = $1 AND status = 'active'`,
    [workspaceId],
  );
  const map = new Map<string, string[]>();
  for (const row of result.rows) {
    const studentId = row.student_id as string;
    const list = map.get(studentId) ?? [];
    list.push(row.batch_id as string);
    map.set(studentId, list);
  }
  return map;
}

/**
 * Mean study minutes across every non-`left` student in the workspace — the
 * Overview "avg study time" KPI. Aggregated in SQL so it does not depend on the
 * (possibly truncated) directory page.
 */
export async function getWorkspaceStudyTimeAverage(
  workspaceId: string,
): Promise<{ averageMinutes: number | null; students: number }> {
  await ensureEnrollmentSchema();
  const result = await pool().query(
    `SELECT AVG(u.total_study_time)::float8 AS avg_minutes, COUNT(*)::int AS students
       FROM app.workspace_student_enrollments e
       INNER JOIN origin_users u ON u.id = e.student_id
      WHERE e.workspace_id = $1 AND e.status <> 'left'`,
    [workspaceId],
  );
  const row = result.rows[0];
  const avg = Number(row?.avg_minutes);
  return {
    averageMinutes: Number.isFinite(avg) ? avg : null,
    students: Number(row?.students) || 0,
  };
}

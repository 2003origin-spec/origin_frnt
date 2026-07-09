/**
 * AI Feature Toggle epic — admin console read queries (PR pair 2).
 *
 * Powers /admin/ai-access: institute/batch browser, tier member lists, student
 * search, and the "why" panel. Separate from ai-access-store.ts (the request
 * hot path) because these join workspaces/batches/users and are admin-only.
 * Effective states are computed by resolveAiAccessBulk (ai-access.ts), not here.
 *
 * Design: V1/ai-feature-toggle/04-server-enforcement-and-apis.md §4,
 *         V1/ai-feature-toggle/05-admin-ui.md.
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureAiAccessSchema } from "./ai-access-schema";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const like = (q: string) => `%${q.trim()}%`;

export type AdminMemberRow = {
  userId: string;
  name: string;
  username: string | null;
  email: string;
  isPremium: boolean;
};

export type AdminBatchRow = {
  id: string;
  name: string;
  status: string;
  workspaceId: string;
  memberCount: number;
};

export type AdminWorkspaceRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  enrollmentCount: number;
  batches: AdminBatchRow[];
};

function memberFromRow(row: Record<string, unknown>): AdminMemberRow {
  return {
    userId: row.id as string,
    name: (row.name as string | null) ?? "",
    username: (row.username as string | null) ?? null,
    email: (row.email as string | null) ?? "",
    isPremium: row.is_premium === true,
  };
}

/** Institutes/teacher spaces with ≥1 active/unassigned enrollment OR type
 * 'institute', with their draft|active batches nested (doc 04 §4.3). */
export async function listWorkspacesForAdmin(input: {
  query?: string;
  limit: number;
  offset: number;
}): Promise<{ items: AdminWorkspaceRow[]; total: number }> {
  await ensureAiAccessSchema();
  const params: unknown[] = [];
  let nameFilter = "";
  if (input.query && input.query.trim()) {
    params.push(like(input.query));
    nameFilter = `AND w.display_name ILIKE $${params.length}`;
  }
  const base = `
    FROM app.teacher_workspaces w
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS cnt
      FROM app.workspace_student_enrollments e
      WHERE e.workspace_id = w.id AND e.status IN ('unassigned','active')
    ) en ON TRUE
    WHERE (w.workspace_type = 'institute' OR en.cnt > 0) ${nameFilter}`;

  const totalRes = await pool().query(`SELECT COUNT(*)::int AS total ${base}`, params);
  const total = Number(totalRes.rows[0]?.total ?? 0);

  const pageParams = [...params, input.limit, input.offset];
  const wsRes = await pool().query(
    `SELECT w.id, w.display_name, w.workspace_type, w.status, COALESCE(en.cnt, 0) AS enrollment_count
     ${base}
     ORDER BY en.cnt DESC NULLS LAST, w.display_name
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );

  const wsIds = wsRes.rows.map((r) => r.id as string);
  const batchesByWs = new Map<string, AdminBatchRow[]>();
  if (wsIds.length > 0) {
    const batchRes = await pool().query(
      `SELECT b.id, b.name, b.status, b.workspace_id, COALESCE(m.cnt, 0) AS member_count
       FROM app.batches b
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS cnt FROM app.batch_members bm
         WHERE bm.batch_id = b.id AND bm.status = 'active'
       ) m ON TRUE
       WHERE b.workspace_id = ANY($1::text[]) AND b.status IN ('draft','active')
       ORDER BY b.name`,
      [wsIds],
    );
    for (const r of batchRes.rows) {
      const wid = r.workspace_id as string;
      const list = batchesByWs.get(wid) ?? [];
      list.push({
        id: r.id as string,
        name: (r.name as string | null) ?? "",
        status: r.status as string,
        workspaceId: wid,
        memberCount: Number(r.member_count ?? 0),
      });
      batchesByWs.set(wid, list);
    }
  }

  const items: AdminWorkspaceRow[] = wsRes.rows.map((r) => ({
    id: r.id as string,
    name: (r.display_name as string | null) ?? "",
    type: (r.workspace_type as string | null) ?? "",
    status: (r.status as string | null) ?? "",
    enrollmentCount: Number(r.enrollment_count ?? 0),
    batches: batchesByWs.get(r.id as string) ?? [],
  }));
  return { items, total };
}

export async function getBatchInfo(
  batchId: string,
): Promise<{ id: string; name: string; workspaceId: string; status: string } | null> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT id, name, workspace_id, status FROM app.batches WHERE id = $1`,
    [batchId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    name: (r.name as string | null) ?? "",
    workspaceId: r.workspace_id as string,
    status: r.status as string,
  };
}

export async function listBatchMembersForAdmin(input: {
  batchId: string;
  query?: string;
  limit: number;
  offset: number;
}): Promise<{ members: AdminMemberRow[]; total: number }> {
  await ensureAiAccessSchema();
  const params: unknown[] = [input.batchId];
  let filter = "";
  if (input.query && input.query.trim()) {
    params.push(like(input.query));
    filter = `AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
  }
  const base = `
    FROM app.batch_members m
    JOIN origin_users u ON u.id = m.student_id
    WHERE m.batch_id = $1 AND m.status = 'active' ${filter}`;
  const totalRes = await pool().query(`SELECT COUNT(*)::int AS total ${base}`, params);
  const pageParams = [...params, input.limit, input.offset];
  const res = await pool().query(
    `SELECT u.id, u.name, u.username, u.email, u.is_premium ${base}
     ORDER BY u.name
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );
  return {
    members: res.rows.map(memberFromRow),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}

export async function listStudentsForAdmin(input: {
  tier: "free" | "premium";
  query?: string;
  limit: number;
  offset: number;
}): Promise<{ members: AdminMemberRow[]; total: number }> {
  await ensureAiAccessSchema();
  const params: unknown[] = [input.tier === "premium"];
  let filter = "";
  if (input.query && input.query.trim()) {
    params.push(like(input.query));
    filter = `AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR username ILIKE $${params.length})`;
  }
  const base = `FROM origin_users WHERE role = 'student' AND is_premium = $1 ${filter}`;
  const totalRes = await pool().query(`SELECT COUNT(*)::int AS total ${base}`, params);
  const pageParams = [...params, input.limit, input.offset];
  const res = await pool().query(
    `SELECT id, name, username, email, is_premium ${base}
     ORDER BY joined_at DESC
     LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
    pageParams,
  );
  return {
    members: res.rows.map(memberFromRow),
    total: Number(totalRes.rows[0]?.total ?? 0),
  };
}

export async function getStudentCountsByTier(): Promise<{ free: number; premium: number }> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT is_premium, COUNT(*)::int AS cnt FROM origin_users WHERE role = 'student' GROUP BY is_premium`,
  );
  let free = 0;
  let premium = 0;
  for (const r of rows) {
    if (r.is_premium === true) premium = Number(r.cnt ?? 0);
    else free = Number(r.cnt ?? 0);
  }
  return { free, premium };
}

export type AdminUserBasic = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: string;
  isPremium: boolean;
};

export async function getUserBasic(userId: string): Promise<AdminUserBasic | null> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT id, name, email, username, role, is_premium FROM origin_users WHERE id = $1`,
    [userId],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as string,
    name: (r.name as string | null) ?? "",
    email: (r.email as string | null) ?? "",
    username: (r.username as string | null) ?? null,
    role: (r.role as string | null) ?? "",
    isPremium: r.is_premium === true,
  };
}

/** Resolve display names for a set of workspace / batch ids (why-chain labels,
 * orphan detection). Returns Maps keyed by id. */
export async function getWorkspaceNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT id, display_name FROM app.teacher_workspaces WHERE id = ANY($1::text[])`,
    [ids],
  );
  for (const r of rows) out.set(r.id as string, (r.display_name as string | null) ?? "");
  return out;
}

export async function getBatchNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT id, name FROM app.batches WHERE id = ANY($1::text[])`,
    [ids],
  );
  for (const r of rows) out.set(r.id as string, (r.name as string | null) ?? "");
  return out;
}

export type RuleValue = "on" | "off" | "inherit";

/** Per-student override (user-scope rule) values for a page of members. Absent
 * ids resolve to 'inherit'. Cheap PK lookup on app.ai_access_rules. */
export async function getUserOverrideValues(
  userIds: string[],
): Promise<Map<string, RuleValue>> {
  const out = new Map<string, RuleValue>();
  if (userIds.length === 0) return out;
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT scope_id, ori_enabled FROM app.ai_access_rules
     WHERE scope_type = 'user' AND scope_id = ANY($1::text[])`,
    [userIds],
  );
  for (const r of rows) {
    const v: RuleValue = r.ori_enabled === null ? "inherit" : r.ori_enabled ? "on" : "off";
    out.set(r.scope_id as string, v);
  }
  return out;
}

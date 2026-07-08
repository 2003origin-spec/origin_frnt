/**
 * Data store for app.ai_access_rules (AI Feature Toggle epic).
 * Aligned to src/db/migrations/20260708_ai_access_rules.sql.
 *
 * Pure Postgres access — the Redis projection + resolver live in
 * src/server/ai-access.ts. Every exported fn ensures the schema first, so the
 * table self-applies on first use in production.
 *
 * Design: V1/ai-feature-toggle/03-database-and-cache.md
 */

import type { Pool } from "pg";

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureAiAccessSchema } from "./ai-access-schema";

export type AiRuleScopeType = "global" | "tier" | "workspace" | "batch" | "user";

export type AiRuleRow = {
  scopeType: AiRuleScopeType;
  scopeId: string;
  oriEnabled: boolean | null;
  explainerEnabled: boolean | null;
  updatedBy: string | null;
  updatedAt: string;
};

/** Per-student context needed to evaluate rules (cached in Redis 120s). */
export type AiUserContext = {
  tier: "free" | "premium";
  wsIds: string[]; // active or unassigned workspace enrollments
  batchIds: string[]; // active membership in draft|active batches
  userRule: { o: boolean | null; e: boolean | null } | null;
};

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value as string).toISOString();
}

function rowToRule(row: Record<string, unknown>): AiRuleRow {
  return {
    scopeType: row.scope_type as AiRuleScopeType,
    scopeId: (row.scope_id as string) ?? "",
    oriEnabled: (row.ori_enabled as boolean | null) ?? null,
    explainerEnabled: (row.explainer_enabled as boolean | null) ?? null,
    updatedBy: (row.updated_by as string | null) ?? null,
    updatedAt: toIso(row.updated_at),
  };
}

/** All rules — admin overview + Redis blob rebuild. */
export async function listRules(): Promise<AiRuleRow[]> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT scope_type, scope_id, ori_enabled, explainer_enabled, updated_by, updated_at
     FROM app.ai_access_rules`,
  );
  return rows.map(rowToRule);
}

export async function getRule(
  scopeType: AiRuleScopeType,
  scopeId: string,
): Promise<AiRuleRow | null> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT scope_type, scope_id, ori_enabled, explainer_enabled, updated_by, updated_at
     FROM app.ai_access_rules WHERE scope_type = $1 AND scope_id = $2`,
    [scopeType, scopeId],
  );
  return rows[0] ? rowToRule(rows[0]) : null;
}

/** Upsert a rule; both feature columns are written in lockstep (D2). */
export async function upsertRule(input: {
  scopeType: AiRuleScopeType;
  scopeId: string;
  ori: boolean;
  explainer: boolean;
  updatedBy: string | null;
}): Promise<AiRuleRow> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `INSERT INTO app.ai_access_rules
       (scope_type, scope_id, ori_enabled, explainer_enabled, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (scope_type, scope_id) DO UPDATE
       SET ori_enabled = EXCLUDED.ori_enabled,
           explainer_enabled = EXCLUDED.explainer_enabled,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()
     RETURNING scope_type, scope_id, ori_enabled, explainer_enabled, updated_by, updated_at`,
    [input.scopeType, input.scopeId, input.ori, input.explainer, input.updatedBy],
  );
  return rowToRule(rows[0]);
}

/** Delete a rule ('inherit'); returns whether a row existed. */
export async function deleteRule(
  scopeType: AiRuleScopeType,
  scopeId: string,
): Promise<boolean> {
  await ensureAiAccessSchema();
  const { rowCount } = await pool().query(
    `DELETE FROM app.ai_access_rules WHERE scope_type = $1 AND scope_id = $2`,
    [scopeType, scopeId],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * One round-trip per student (also used in bulk for admin lists). Encodes the
 * membership/tier semantics — see doc 03 §4.1:
 *  - tier = is_premium mirror
 *  - batches: active membership in draft|active batches only
 *  - enrollments: unassigned|active only
 *  - the user override rides along in the same query
 */
export async function getUserAiContexts(
  userIds: string[],
): Promise<Map<string, AiUserContext>> {
  const out = new Map<string, AiUserContext>();
  if (userIds.length === 0) return out;
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT u.id,
            u.is_premium,
            COALESCE(bm.batch_ids, '{}') AS batch_ids,
            COALESCE(en.ws_ids,   '{}')  AS ws_ids,
            r.ori_enabled                AS user_ori,
            r.explainer_enabled          AS user_explainer,
            (r.scope_id IS NOT NULL)     AS has_user_rule
     FROM origin_users u
     LEFT JOIN LATERAL (
       SELECT array_agg(m.batch_id) AS batch_ids
       FROM app.batch_members m
       JOIN app.batches b ON b.id = m.batch_id
       WHERE m.student_id = u.id
         AND m.status = 'active'
         AND b.status IN ('draft','active')
     ) bm ON TRUE
     LEFT JOIN LATERAL (
       SELECT array_agg(e.workspace_id) AS ws_ids
       FROM app.workspace_student_enrollments e
       WHERE e.student_id = u.id
         AND e.status IN ('unassigned','active')
     ) en ON TRUE
     LEFT JOIN app.ai_access_rules r
       ON r.scope_type = 'user' AND r.scope_id = u.id
     WHERE u.id = ANY($1::text[])`,
    [userIds],
  );
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    out.set(r.id as string, {
      tier: r.is_premium ? "premium" : "free",
      wsIds: ((r.ws_ids as string[] | null) ?? []).filter(Boolean),
      batchIds: ((r.batch_ids as string[] | null) ?? []).filter(Boolean),
      userRule: r.has_user_rule
        ? {
            o: (r.user_ori as boolean | null) ?? null,
            e: (r.user_explainer as boolean | null) ?? null,
          }
        : null,
    });
  }
  return out;
}

/** Non-default rule counts for the admin overview. */
export async function countRules(): Promise<{
  workspaceRules: number;
  batchRules: number;
  userOverrides: number;
}> {
  await ensureAiAccessSchema();
  const { rows } = await pool().query(
    `SELECT
       COUNT(*) FILTER (WHERE scope_type = 'workspace') AS workspace_rules,
       COUNT(*) FILTER (WHERE scope_type = 'batch')     AS batch_rules,
       COUNT(*) FILTER (WHERE scope_type = 'user')      AS user_overrides
     FROM app.ai_access_rules`,
  );
  const row = rows[0] ?? {};
  return {
    workspaceRules: Number(row.workspace_rules ?? 0),
    batchRules: Number(row.batch_rules ?? 0),
    userOverrides: Number(row.user_overrides ?? 0),
  };
}

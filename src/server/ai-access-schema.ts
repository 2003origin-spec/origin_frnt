/**
 * Idempotent runtime ensure for the AI Feature Toggle epic —
 * app.ai_access_rules (per-scope admin-controlled AI access rules).
 *
 * Self-applies on first use in every environment, so production needs zero
 * manual migration steps. Postgres is the source of truth; Upstash Redis holds
 * projections (see src/server/ai-access.ts).
 *
 * Canonical SQL: src/db/migrations/20260708_ai_access_rules.sql
 * Design: V1/ai-feature-toggle/03-database-and-cache.md
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureEnrollmentSchema } from "@/server/workspaces/enrollment-schema";

declare global {
  var __originAiAccessSchemaEnsured: boolean | undefined;
  var __originAiAccessSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260708_ai_access_rules";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "AI feature toggle — app.ai_access_rules"],
  );
}

export async function ensureAiAccessSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originAiAccessSchemaEnsured) return;
  if (!globalThis.__originAiAccessSchemaPromise) {
    globalThis.__originAiAccessSchemaPromise = (async () => {
      // origin_users (+ the app schema and app.migrations ledger) must exist
      // before the updated_by FK and the ledger insert below validate.
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`
          CREATE TABLE IF NOT EXISTS app.ai_access_rules (
            scope_type TEXT NOT NULL CHECK (scope_type IN ('global','tier','workspace','batch','user')),
            scope_id   TEXT NOT NULL DEFAULT '',
            ori_enabled       BOOLEAN,
            explainer_enabled BOOLEAN,
            updated_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (scope_type, scope_id),
            CONSTRAINT ai_rules_tier_ids  CHECK (scope_type <> 'tier'   OR scope_id IN ('free','premium')),
            CONSTRAINT ai_rules_global_id CHECK (
              scope_type <> 'global'
              OR (scope_id = '' AND ori_enabled IS NOT NULL AND explainer_enabled IS NOT NULL)
            )
          );
        `);

        await client.query(`
          INSERT INTO app.ai_access_rules (scope_type, scope_id, ori_enabled, explainer_enabled)
          VALUES ('global', '', TRUE, TRUE)
          ON CONFLICT (scope_type, scope_id) DO NOTHING;
        `);

        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_origin_users_role_premium
            ON origin_users (role, is_premium);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originAiAccessSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originAiAccessSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originAiAccessSchemaPromise;
}

import "server-only";

/**
 * Runtime ensure for the `counselling` schema (USER database). Creates the
 * empty tables on first use (TEST_CASES T8.6); the data itself only comes
 * from `npm run counselling:import` (plan §6.2). DDL: ./schema-ddl.ts.
 */

import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { COUNSELLING_MIGRATION_ID, COUNSELLING_MIGRATION_NAME, COUNSELLING_SCHEMA_DDL } from "./schema-ddl";

declare global {
  var __originCounsellingSchemaEnsured: boolean | undefined;
  var __originCounsellingSchemaPromise: Promise<void> | undefined;
}

export async function ensureCounsellingSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originCounsellingSchemaEnsured) return;
  if (!globalThis.__originCounsellingSchemaPromise) {
    globalThis.__originCounsellingSchemaPromise = (async () => {
      const pool = getUserPostgresPool();
      if (!pool) throw new Error("USER_DATABASE_URL is not configured");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // One shared lock for all runtime DDL (see src/server/schema-lock.ts).
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
        for (const statement of COUNSELLING_SCHEMA_DDL) await client.query(statement);
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
        await client.query("INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [
          COUNSELLING_MIGRATION_ID,
          COUNSELLING_MIGRATION_NAME,
        ]);
        await client.query("COMMIT");
        globalThis.__originCounsellingSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().finally(() => {
      globalThis.__originCounsellingSchemaPromise = undefined;
    });
  }
  await globalThis.__originCounsellingSchemaPromise;
}

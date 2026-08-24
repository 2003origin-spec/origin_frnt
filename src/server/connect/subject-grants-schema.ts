/**
 * Idempotent runtime ensure for the Phase 14 entitlements schema —
 * entitlements.subject_grants.
 *
 * Single source for grant-shaped subject access: Flow-1 `teacher_code` grants,
 * `admin_comp` comps, and `paid_order` prepaid terms bought through Rail A
 * (V1/RAZORPAY_PAYMENTS_PLAN.md D3). getEntitledSubjects() resolves the UNION of
 * these grants and the Razorpay-backed subscriptions.user_subscriptions rows at
 * read time — adding `paid_order` therefore changes no read-path code.
 *
 * Canonical SQL: src/db/migrations/20260604_phase14_subject_grants.sql
 */

import type { PoolClient } from "pg";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureEnrollmentSchema } from "@/server/workspaces/enrollment-schema";

declare global {
  var __originSubjectGrantsSchemaEnsured: boolean | undefined;
  var __originSubjectGrantsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260604_phase14_subject_grants";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 14 entitlements.subject_grants"],
  );
}

export async function ensureSubjectGrantsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originSubjectGrantsSchemaEnsured) return;
  if (!globalThis.__originSubjectGrantsSchemaPromise) {
    globalThis.__originSubjectGrantsSchemaPromise = (async () => {
      // origin_users + app.teacher_workspaces + app.workspace_student_enrollments
      // must exist before the FKs below validate. Phase 3 ensure covers all three.
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // Serialise DDL across connections — `CREATE TABLE IF NOT EXISTS` is not
        // atomic against a concurrent creator (pg_type unique violation).
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);

        // ensureUserSchema() creates the `app` schema but NOT app.migrations —
        // that table is only created by store-postgres/platform-settings, which
        // may not have run yet on a fresh database. Without this, the ledger
        // INSERT below throws and rolls back the entire ensure, leaving the
        // table it was meant to create absent.
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`CREATE SCHEMA IF NOT EXISTS entitlements;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE entitlements.grant_status AS ENUM ('active', 'revoked', 'expired');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS entitlements.subject_grants (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL CHECK (subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
            source TEXT NOT NULL CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order')),
            workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE SET NULL,
            enrollment_id TEXT REFERENCES app.workspace_student_enrollments(id) ON DELETE SET NULL,
            status entitlements.grant_status NOT NULL DEFAULT 'active',
            expires_at TIMESTAMPTZ,
            granted_by TEXT REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_workspace
            ON entitlements.subject_grants(user_id, subject, workspace_id)
            WHERE status = 'active' AND workspace_id IS NOT NULL;

          CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_admin_comp
            ON entitlements.subject_grants(user_id, subject)
            WHERE status = 'active' AND source = 'admin_comp';

          CREATE INDEX IF NOT EXISTS idx_subject_grants_user_status
            ON entitlements.subject_grants(user_id, status);
          CREATE INDEX IF NOT EXISTS idx_subject_grants_entitlement
            ON entitlements.subject_grants(user_id, status, expires_at);
        `);

        // Self-heal a database created before the payments epic: widen the
        // source CHECK to admit 'paid_order' and add the order backlink.
        //
        // GUARDED, and that guard matters. Running the ALTERs unconditionally
        // took an AccessExclusiveLock on subject_grants on EVERY cold start —
        // which re-validated the whole CHECK against every row, and deadlocked
        // against ordinary row traffic from another process (the shared DDL
        // lock only serialises DDL against DDL, never against DML). On an
        // already-correct database this block now issues no DDL at all.
        // Canonical SQL: src/db/migrations/20260822_payments_grant_source.sql
        await client.query(`
          DO $$
          DECLARE constraint_def TEXT;
          BEGIN
            SELECT pg_get_constraintdef(oid) INTO constraint_def
              FROM pg_constraint
             WHERE conrelid = 'entitlements.subject_grants'::regclass
               AND conname = 'subject_grants_source_check';

            IF constraint_def IS NULL OR position('paid_order' IN constraint_def) = 0 THEN
              ALTER TABLE entitlements.subject_grants
                DROP CONSTRAINT IF EXISTS subject_grants_source_check;
              ALTER TABLE entitlements.subject_grants
                ADD CONSTRAINT subject_grants_source_check
                CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order'));
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'entitlements'
                 AND table_name = 'subject_grants'
                 AND column_name = 'order_id'
            ) THEN
              ALTER TABLE entitlements.subject_grants ADD COLUMN order_id TEXT;
            END IF;
          END $$;

          CREATE INDEX IF NOT EXISTS idx_subject_grants_order
            ON entitlements.subject_grants(order_id) WHERE order_id IS NOT NULL;
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originSubjectGrantsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originSubjectGrantsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originSubjectGrantsSchemaPromise;
}

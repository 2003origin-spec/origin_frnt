/**
 * Idempotent runtime ensure for Feature A — admin-gated teacher code access.
 *
 * Adds the "live grant" columns to app.teacher_workspaces (read at redeem time)
 * and the app.teacher_code_requests request/approval ledger. Self-applies on
 * first use; production needs no manual migration. Canonical SQL:
 * src/db/migrations/20260724_teacher_code_access.sql. Grandfather rule: the
 * ADD COLUMN default leaves every pre-existing workspace at code_access_status
 * 'legacy' with a NULL student_quota, so quota enforcement (which only runs when
 * student_quota IS NOT NULL) never touches live teachers until an admin grants a
 * quota. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureWorkspaceSchema } from "./schema";

// NOTE: the workspace-level grant columns (code_access_status / student_quota /
// code_ai_access) live in ensureWorkspaceSchema so every workspace read/insert
// always has them; the CodeAccessStatus type lives in ./types. This module owns
// only the request/approval ledger below.

declare global {
  var __originCodeAccessSchemaEnsured: boolean | undefined;
  var __originCodeAccessSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260724_teacher_code_access";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "admin-gated teacher code access — workspace columns + teacher_code_requests"],
  );
}

export async function ensureCodeAccessSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originCodeAccessSchemaEnsured) return;
  if (!globalThis.__originCodeAccessSchemaPromise) {
    globalThis.__originCodeAccessSchemaPromise = (async () => {
      // teacher_workspaces (+ its code-access columns) + workspace_codes +
      // app.migrations must exist first.
      await ensureWorkspaceSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        // Request / approval ledger.
        await client.query(`
          CREATE TABLE IF NOT EXISTS app.teacher_code_requests (
            id                      TEXT PRIMARY KEY,
            workspace_id            TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            requested_by            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            requested_student_count INT NOT NULL CHECK (requested_student_count > 0),
            ai_access               BOOLEAN NOT NULL DEFAULT FALSE,
            status                  TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending','approved','rejected','cancelled')),
            granted_quota           INT,
            granted_code_id         TEXT REFERENCES app.workspace_codes(id) ON DELETE SET NULL,
            admin_note              TEXT,
            decided_by              TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            decided_at              TIMESTAMPTZ,
            created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          CREATE INDEX IF NOT EXISTS idx_teacher_code_requests_status
            ON app.teacher_code_requests(status, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_teacher_code_requests_workspace
            ON app.teacher_code_requests(workspace_id, status);
          -- At most one open request per workspace.
          CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_code_request_pending
            ON app.teacher_code_requests(workspace_id) WHERE status = 'pending';
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originCodeAccessSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originCodeAccessSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originCodeAccessSchemaPromise;
}

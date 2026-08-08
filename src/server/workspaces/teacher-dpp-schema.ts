/**
 * Idempotent runtime ensure for the teacher test → batch DPP share schema.
 * Canonical SQL: src/db/migrations/20260808_teacher_dpp_shares.sql
 * Plan: V1/allmd/TEACHER_TEST_AS_DPP_PLAN.md (Phase 0)
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureAssessmentSchema } from "./assessment-schema";

declare global {
  var __originTeacherDppSchemaEnsured: boolean | undefined;
  var __originTeacherDppSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260808_teacher_dpp_shares";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "teacher test as dpp shares"],
  );
}

export async function ensureTeacherDppSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originTeacherDppSchemaEnsured) return;
  if (!globalThis.__originTeacherDppSchemaPromise) {
    globalThis.__originTeacherDppSchemaPromise = (async () => {
      // app.batches + assessment.tests must exist before the FKs below resolve.
      await ensureAssessmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS assessment;`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS assessment.teacher_dpp_shares (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            test_id TEXT NOT NULL REFERENCES assessment.tests(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            subject TEXT NOT NULL,
            summary TEXT,
            duration_minutes INTEGER NOT NULL,
            question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            teacher_display_name TEXT NOT NULL,
            teacher_logo_url TEXT,
            shared_by TEXT NOT NULL REFERENCES origin_users(id),
            shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ
          );

          CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_workspace
            ON assessment.teacher_dpp_shares(workspace_id, shared_at DESC);
          CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_test
            ON assessment.teacher_dpp_shares(test_id, shared_at DESC);
          CREATE INDEX IF NOT EXISTS idx_teacher_dpp_shares_expiry
            ON assessment.teacher_dpp_shares(expires_at) WHERE revoked_at IS NULL;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS assessment.teacher_dpp_share_batches (
            share_id TEXT NOT NULL REFERENCES assessment.teacher_dpp_shares(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            PRIMARY KEY (share_id, batch_id)
          );

          CREATE INDEX IF NOT EXISTS idx_teacher_dpp_share_batches_batch
            ON assessment.teacher_dpp_share_batches(batch_id);
        `);

        // Marks snapshot parallel to question_ids — a correct answer in the
        // shared DPP is worth what it was worth in the teacher's test. NULL on
        // shares created before this column existed; those fall back to the
        // default practice policy rather than re-scoring.
        // Mirrors 20260808_teacher_dpp_scoring.sql.
        await client.query(`
          ALTER TABLE assessment.teacher_dpp_shares
            ADD COLUMN IF NOT EXISTS question_marks JSONB;
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originTeacherDppSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originTeacherDppSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originTeacherDppSchemaPromise;
}

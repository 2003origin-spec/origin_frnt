/**
 * Idempotent runtime ensure for Phase 4 Question Bag schema.
 * Canonical SQL: src/db/migrations/20260520_phase4_question_bag.sql
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { ensureEnrollmentSchema } from "./enrollment-schema";

declare global {
  var __originContentSchemaEnsured: boolean | undefined;
  var __originContentSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260520_phase4_question_bag";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 4 question bag"],
  );
}

export async function ensureContentSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originContentSchemaEnsured) return;
  if (!globalThis.__originContentSchemaPromise) {
    globalThis.__originContentSchemaPromise = (async () => {
      await ensureEnrollmentSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        await client.query(`CREATE SCHEMA IF NOT EXISTS content;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE content.asset_owner_type AS ENUM ('workspace', 'platform', 'user');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.asset_kind AS ENUM ('image', 'pdf', 'doc', 'docx', 'video', 'audio', 'other');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.question_owner_scope AS ENUM ('platform', 'workspace');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.question_visibility AS ENUM ('private', 'workspace', 'public_ogcode');
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.question_status AS ENUM (
              'draft',
              'needs_review',
              'ready',
              'published_private',
              'submitted_to_ogcode',
              'published_ogcode',
              'rejected',
              'archived'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.question_type AS ENUM (
              'mcq', 'msq', 'numerical', 'numerical_with_units',
              'symbolic_expression', 'equation', 'matrix_match', 'subjective'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;

          DO $$ BEGIN
            CREATE TYPE content.question_asset_purpose AS ENUM (
              'reference_image', 'reference_diagram', 'reference_table',
              'solution_image', 'source_page_snapshot'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.assets (
            id TEXT PRIMARY KEY,
            owner_type content.asset_owner_type NOT NULL,
            owner_workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            owner_user_id TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            kind content.asset_kind NOT NULL,
            mime_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            byte_size BIGINT NOT NULL,
            sha256 TEXT NOT NULL,
            r2_bucket TEXT NOT NULL,
            r2_object_key TEXT NOT NULL,
            public_url TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by TEXT REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_bucket_key
            ON content.assets(r2_bucket, r2_object_key);
          CREATE INDEX IF NOT EXISTS idx_assets_workspace_kind
            ON content.assets(owner_workspace_id, kind, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_assets_sha256
            ON content.assets(sha256);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.questions (
            id TEXT PRIMARY KEY,
            owner_scope content.question_owner_scope NOT NULL,
            workspace_id TEXT REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            created_by TEXT NOT NULL REFERENCES origin_users(id),
            current_version_id TEXT,
            visibility content.question_visibility NOT NULL DEFAULT 'private',
            status content.question_status NOT NULL DEFAULT 'draft',
            source_kind TEXT NOT NULL DEFAULT 'manual',
            imported_job_id TEXT,
            external_source_id TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CHECK (
              (owner_scope = 'platform' AND workspace_id IS NULL)
              OR (owner_scope = 'workspace' AND workspace_id IS NOT NULL)
            )
          );

          CREATE INDEX IF NOT EXISTS idx_questions_workspace_status
            ON content.questions(workspace_id, status, updated_at DESC);
          CREATE INDEX IF NOT EXISTS idx_questions_visibility_status
            ON content.questions(visibility, status, updated_at DESC);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.question_versions (
            id TEXT PRIMARY KEY,
            question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
            version_number INTEGER NOT NULL,
            question_type content.question_type NOT NULL,
            stem TEXT NOT NULL,
            options JSONB,
            correct_option INTEGER,
            correct_options JSONB,
            answer_text TEXT,
            answer_spec JSONB,
            matrix_data JSONB,
            image_url TEXT,
            hint TEXT,
            explanation TEXT,
            full_solution TEXT,
            subject TEXT NOT NULL,
            chapter TEXT NOT NULL,
            concept TEXT NOT NULL,
            difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard', 'insane')),
            tags TEXT[] NOT NULL DEFAULT '{}',
            import_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by TEXT NOT NULL REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (question_id, version_number)
          );

          CREATE INDEX IF NOT EXISTS idx_question_versions_subject_chapter
            ON content.question_versions(subject, chapter, concept);
          CREATE INDEX IF NOT EXISTS idx_question_versions_question
            ON content.question_versions(question_id, version_number DESC);

          -- Additive: manual question diagram image (existing DBs).
          ALTER TABLE content.question_versions ADD COLUMN IF NOT EXISTS image_url TEXT;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS content.question_asset_links (
            question_version_id TEXT NOT NULL REFERENCES content.question_versions(id) ON DELETE CASCADE,
            asset_id TEXT NOT NULL REFERENCES content.assets(id) ON DELETE CASCADE,
            purpose content.question_asset_purpose NOT NULL,
            display_order INTEGER NOT NULL DEFAULT 0,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            PRIMARY KEY (question_version_id, asset_id, purpose)
          );

          CREATE INDEX IF NOT EXISTS idx_question_asset_links_asset
            ON content.question_asset_links(asset_id);
        `);

        // Question clusters — mirrors 20260813_question_clusters.sql so an
        // un-migrated database self-heals. Membership is ORDERED: a cluster is
        // stacked into a paper, so its order is the order questions get asked.
        // See V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §3.
        await client.query(`
          CREATE TABLE IF NOT EXISTS content.question_clusters (
            id                   TEXT PRIMARY KEY,
            workspace_id         TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            name                 TEXT NOT NULL,
            description          TEXT,
            source_import_job_id TEXT,
            created_by           TEXT REFERENCES origin_users(id),
            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_content_clusters_workspace
            ON content.question_clusters(workspace_id, created_at DESC);

          CREATE TABLE IF NOT EXISTS content.question_cluster_members (
            cluster_id  TEXT NOT NULL REFERENCES content.question_clusters(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
            position    INTEGER NOT NULL,
            added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (cluster_id, question_id)
          );

          CREATE INDEX IF NOT EXISTS idx_content_cluster_members_ordered
            ON content.question_cluster_members(cluster_id, position);
          CREATE INDEX IF NOT EXISTS idx_content_cluster_members_question
            ON content.question_cluster_members(question_id);
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originContentSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originContentSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originContentSchemaPromise;
}
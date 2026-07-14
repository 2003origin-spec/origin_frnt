/**
 * Idempotent runtime ensure for the CBT module schema.
 * Canonical SQL: src/db/migrations/20260705_cbt_module.sql
 *
 * Also performs the origin_users role-CHECK widening (adds 'cbt_teacher') for
 * fresh environments. In production the shared CHECK is applied explicitly via
 * the dated migration (see CBT_implementation.md, Phase 12) — this module keeps
 * dev/preview environments consistent without a manual step.
 */

import type { PoolClient } from "pg";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureUserSchema } from "@/server/db-users";

declare global {
  var __originCbtSchemaEnsured: boolean | undefined;
  var __originCbtSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260705_cbt_module";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "cbt module foundation"],
  );
}

export async function ensureCbtSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originCbtSchemaEnsured) return;
  if (!globalThis.__originCbtSchemaPromise) {
    globalThis.__originCbtSchemaPromise = (async () => {
      // origin_users + app.migrations must exist before we widen the CHECK.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");

        // Widen the shared origin_users role CHECK to include 'cbt_teacher'.
        await client.query(`
          DO $$
          BEGIN
            ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_role_check;
            ALTER TABLE origin_users
              ADD CONSTRAINT origin_users_role_check
              CHECK (role IN ('student', 'teacher', 'admin', 'cbt_teacher'));
          END $$;
        `);

        await client.query(`CREATE SCHEMA IF NOT EXISTS cbt;`);

        await client.query(`
          CREATE TABLE IF NOT EXISTS cbt.teachers (
            id                  TEXT PRIMARY KEY,
            user_id             TEXT UNIQUE,
            email               TEXT UNIQUE NOT NULL,
            display_name        TEXT,
            status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
            import_workspace_id TEXT,
            added_by_admin_id   TEXT,
            created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS cbt.login_otps (
            email        TEXT PRIMARY KEY,
            code_hash    TEXT NOT NULL,
            expires_at   TIMESTAMPTZ NOT NULL,
            attempts     INTEGER NOT NULL DEFAULT 0,
            last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            verified_at  TIMESTAMPTZ
          );

          CREATE TABLE IF NOT EXISTS cbt.questions (
            id            TEXT PRIMARY KEY,
            teacher_id    TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            question_type TEXT NOT NULL CHECK (question_type IN (
                            'mcq', 'msq', 'numerical', 'numerical_with_units',
                            'symbolic_expression', 'equation', 'matrix_match', 'subjective')),
            stem          TEXT NOT NULL DEFAULT '',
            image         TEXT,
            options       JSONB NOT NULL DEFAULT '[]'::jsonb,
            answer        JSONB NOT NULL DEFAULT '{}'::jsonb,
            explanation   TEXT,
            subject       TEXT,
            chapter       TEXT,
            concept       TEXT,
            difficulty    TEXT,
            source        TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'imported')),
            import_job_id TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- Additive column for environments that already have cbt.questions.
          ALTER TABLE cbt.questions ADD COLUMN IF NOT EXISTS image TEXT;

          CREATE TABLE IF NOT EXISTS cbt.tests (
            id               TEXT PRIMARY KEY,
            teacher_id       TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            title            TEXT NOT NULL,
            description      TEXT,
            duration_minutes INTEGER NOT NULL DEFAULT 60,
            status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'archived')),
            settings         JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS cbt.test_questions (
            test_id        TEXT NOT NULL REFERENCES cbt.tests(id) ON DELETE CASCADE,
            position       INTEGER NOT NULL,
            question_id    TEXT NOT NULL REFERENCES cbt.questions(id) ON DELETE RESTRICT,
            marks          DOUBLE PRECISION NOT NULL DEFAULT 4,
            negative_marks DOUBLE PRECISION NOT NULL DEFAULT -1,
            PRIMARY KEY (test_id, position)
          );

          CREATE TABLE IF NOT EXISTS cbt.rooms (
            id               TEXT PRIMARY KEY,
            teacher_id       TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            name             TEXT NOT NULL,
            public_slug      TEXT UNIQUE NOT NULL,
            code_hash        TEXT NOT NULL,
            status           TEXT NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_test', 'finished', 'closed')),
            test_id          TEXT REFERENCES cbt.tests(id) ON DELETE SET NULL,
            started_at       TIMESTAMPTZ,
            duration_seconds INTEGER,
            ended_at         TIMESTAMPTZ,
            capacity         INTEGER NOT NULL DEFAULT 200,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS cbt.room_participants (
            id                 TEXT PRIMARY KEY,
            room_id            TEXT NOT NULL REFERENCES cbt.rooms(id) ON DELETE CASCADE,
            display_name       TEXT NOT NULL,
            student_code       TEXT NOT NULL,
            token_version      INTEGER NOT NULL DEFAULT 1,
            joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            kicked             BOOLEAN NOT NULL DEFAULT FALSE,
            entered_test_at    TIMESTAMPTZ,
            last_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            finished_at        TIMESTAMPTZ,
            auto_submitted     BOOLEAN NOT NULL DEFAULT FALSE,
            answered_count     INTEGER NOT NULL DEFAULT 0,
            score              DOUBLE PRECISION,
            max_score          DOUBLE PRECISION,
            rank               INTEGER,
            time_taken_seconds INTEGER,
            UNIQUE (room_id, student_code)
          );

          CREATE TABLE IF NOT EXISTS cbt.answer_drafts (
            room_id        TEXT NOT NULL REFERENCES cbt.rooms(id) ON DELETE CASCADE,
            participant_id TEXT NOT NULL REFERENCES cbt.room_participants(id) ON DELETE CASCADE,
            answers        JSONB NOT NULL DEFAULT '{}'::jsonb,
            palette        JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (room_id, participant_id)
          );

          CREATE TABLE IF NOT EXISTS cbt.submission_answers (
            room_id           TEXT NOT NULL REFERENCES cbt.rooms(id) ON DELETE CASCADE,
            participant_id    TEXT NOT NULL REFERENCES cbt.room_participants(id) ON DELETE CASCADE,
            position          INTEGER NOT NULL,
            question_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
            submitted_answer  JSONB NOT NULL DEFAULT '{}'::jsonb,
            grading_result    JSONB NOT NULL DEFAULT '{}'::jsonb,
            marks_awarded     DOUBLE PRECISION NOT NULL DEFAULT 0,
            PRIMARY KEY (room_id, participant_id, position)
          );

          -- Question clusters (many-to-many collections; see 20260707_cbt_clusters.sql).
          CREATE TABLE IF NOT EXISTS cbt.question_clusters (
            id          TEXT PRIMARY KEY,
            teacher_id  TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
            name        TEXT NOT NULL,
            description TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE TABLE IF NOT EXISTS cbt.question_cluster_members (
            cluster_id  TEXT NOT NULL REFERENCES cbt.question_clusters(id) ON DELETE CASCADE,
            question_id TEXT NOT NULL REFERENCES cbt.questions(id) ON DELETE CASCADE,
            added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (cluster_id, question_id)
          );

          CREATE INDEX IF NOT EXISTS idx_cbt_rooms_teacher ON cbt.rooms (teacher_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_cbt_participants_room_seen ON cbt.room_participants (room_id, last_seen_at);
          CREATE INDEX IF NOT EXISTS idx_cbt_questions_teacher ON cbt.questions (teacher_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_cbt_tests_teacher ON cbt.tests (teacher_id);
          CREATE INDEX IF NOT EXISTS idx_cbt_clusters_teacher ON cbt.question_clusters (teacher_id, created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_cbt_cluster_members_q ON cbt.question_cluster_members (question_id);
        `);

        await recordMigration(client);
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          ["20260707_cbt_clusters", "cbt question clusters"],
        );
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          ["20260714_cbt_questions_image", "cbt questions image column"],
        );
        await client.query("COMMIT");
        globalThis.__originCbtSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originCbtSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originCbtSchemaPromise;
}

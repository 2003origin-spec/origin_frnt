-- Four tables that until now existed only as runtime-ensure DDL, with no
-- migration and no rollback, so run-migrations.mjs, the prod schema audit and
-- a rollback could not see them. The CREATE TABLE / CREATE INDEX blocks below
-- are copied verbatim from their runtime-ensure modules, which stay in place
-- (production already has these tables; every statement is IF NOT EXISTS):
--
--   content.batch_messages      src/server/workspaces/batch-messages-store.ts  (ensureBatchMessagesSchema)
--   app.batch_topic_coverage    src/server/workspaces/batch-topic-coverage-store.ts (ensureBatchTopicCoverageSchema)
--   content.syllabus_nodes      src/server/workspaces/syllabus-schema.ts        (ensureSyllabusSchema)
--   app.premium_event_mode      src/server/premium-access-schema.ts             (ensurePremiumEventModeSchema)
--
-- Keep them in step: a change to one of those modules needs the same change in
-- a new migration. tests/unit/runtime-ddl-migration-drift.test.ts enforces that
-- every runtime CREATE TABLE has a migration.
--
-- Requires app.teacher_workspaces, app.batches and origin_users (phase 1/3
-- migrations). Additive + idempotent. Target: USER_DATABASE_URL.
-- Not in the run-migrations.mjs allowlist (same as every non-payment migration
-- since 20260831): apply by hand, or let the runtime ensure create the tables.

BEGIN;

CREATE SCHEMA IF NOT EXISTS content;

-- content.batch_messages (batch communication hub)
          CREATE TABLE IF NOT EXISTS content.batch_messages (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            sender_id TEXT NOT NULL REFERENCES origin_users(id),
            sender_role TEXT NOT NULL CHECK (sender_role IN ('teacher', 'student')),
            body TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'link')),
            link_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_batch_messages_batch
            ON content.batch_messages(workspace_id, batch_id, created_at DESC);

-- app.batch_topic_coverage (teacher-marked topic coverage per batch)
        CREATE TABLE IF NOT EXISTS app.batch_topic_coverage (
          id BIGSERIAL PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
          batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
          subject TEXT NOT NULL,
          topic TEXT NOT NULL,
          covered BOOLEAN NOT NULL DEFAULT FALSE,
          covered_at TIMESTAMPTZ,
          updated_by TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (workspace_id, batch_id, subject, topic)
        );
        CREATE INDEX IF NOT EXISTS idx_batch_topic_coverage_batch
          ON app.batch_topic_coverage(workspace_id, batch_id);

-- content.syllabus_nodes (batch syllabus tree)
          CREATE TABLE IF NOT EXISTS content.syllabus_nodes (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
            batch_id TEXT NOT NULL REFERENCES app.batches(id) ON DELETE CASCADE,
            parent_id TEXT REFERENCES content.syllabus_nodes(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK (kind IN ('chapter', 'topic')),
            title TEXT NOT NULL,
            subject TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            manual_status TEXT CHECK (manual_status IN ('mastered', 'in_progress', 'unstarted')),
            created_by TEXT REFERENCES origin_users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_syllabus_nodes_batch
            ON content.syllabus_nodes(workspace_id, batch_id, parent_id, sort_order);

-- app.premium_event_mode (admin Premium Pro event-mode singleton) + its seed row.
-- The idx_origin_users_role_premium index the same ensure creates is owned by
-- 20260708_ai_access_rules.sql and is not repeated here.
          CREATE TABLE IF NOT EXISTS app.premium_event_mode (
            id             BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
            active         BOOLEAN NOT NULL DEFAULT FALSE,
            auto_revert_at TIMESTAMPTZ,
            updated_by     TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
          );

          INSERT INTO app.premium_event_mode (id, active)
          VALUES (TRUE, FALSE)
          ON CONFLICT (id) DO NOTHING;

-- Same ledger ids the runtime ensures record, plus this file's own.
INSERT INTO app.migrations (id, name) VALUES
  ('20260629_batch_messages', 'batch communication hub'),
  ('20260629_batch_syllabus', 'batch syllabus tree'),
  ('20260709_premium_event_mode', 'admin premium access — app.premium_event_mode'),
  ('20261022_runtime_only_tables', 'migration for runtime-only tables (batch messages, topic coverage, syllabus, premium event mode)')
ON CONFLICT (id) DO NOTHING;

COMMIT;

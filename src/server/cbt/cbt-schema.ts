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
            logo                TEXT,
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

          -- Additive columns for environments that already have these tables.
          -- (Only for tables created ABOVE this point — an ALTER of a table
          -- that is still further down the script fails on a fresh database.)
          ALTER TABLE cbt.questions ADD COLUMN IF NOT EXISTS image TEXT;
          ALTER TABLE cbt.teachers ADD COLUMN IF NOT EXISTS logo TEXT;

          -- Report cards (20260804): the ADMIN switch for the premium
          -- report-card feature. FALSE for every existing teacher.
          ALTER TABLE cbt.teachers ADD COLUMN IF NOT EXISTS report_cards_enabled BOOLEAN NOT NULL DEFAULT FALSE;

          -- Participation quota (20260808): the ADMIN cap on cumulative test
          -- participations. NULL = UNLIMITED, which is the grandfather rule —
          -- every enforcement branch short-circuits on a null quota, so an
          -- existing teacher is untouched until an admin sets a number.
          -- The renewal policy (CBT is sold as a subscription): the current
          -- window is DERIVED from (anchor, mode, days, now) at read time and
          -- usage counts only ledger rows inside it, so the allowance returns to
          -- 0 with no reset job and no stored window to drift.
          ALTER TABLE cbt.teachers
            ADD COLUMN IF NOT EXISTS participation_quota INTEGER,
            ADD COLUMN IF NOT EXISTS quota_updated_at    TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS quota_notified_at   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS quota_reset_mode    TEXT NOT NULL DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS quota_period_days   INTEGER,
            ADD COLUMN IF NOT EXISTS quota_period_anchor TIMESTAMPTZ;

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

          -- Identity-recovery policy (20260802), additive for existing rooms.
          ALTER TABLE cbt.rooms ADD COLUMN IF NOT EXISTS rejoin_policy TEXT NOT NULL DEFAULT 'name_or_id';

          -- Report cards (20260804): the TEACHER switch, per room. Only a
          -- published room can resolve a shareable report link.
          ALTER TABLE cbt.rooms ADD COLUMN IF NOT EXISTS report_share_enabled BOOLEAN NOT NULL DEFAULT FALSE;

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

          -- Attempt-resilience columns (20260802): why an attempt ended, the
          -- identity-recovery audit trail, and the integrity strike count.
          ALTER TABLE cbt.room_participants
            ADD COLUMN IF NOT EXISTS finalize_reason TEXT,
            ADD COLUMN IF NOT EXISTS rejoin_count    INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS last_rejoin_at  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;

          -- Sectional marking (20260804): per-subject breakdown written at
          -- grading time. Legacy rows stay '{}' and are derived on read from
          -- cbt.submission_answers, so no backfill is required.
          ALTER TABLE cbt.room_participants
            ADD COLUMN IF NOT EXISTS section_scores JSONB NOT NULL DEFAULT '{}'::jsonb;

          CREATE TABLE IF NOT EXISTS cbt.answer_drafts (
            room_id        TEXT NOT NULL REFERENCES cbt.rooms(id) ON DELETE CASCADE,
            participant_id TEXT NOT NULL REFERENCES cbt.room_participants(id) ON DELETE CASCADE,
            answers        JSONB NOT NULL DEFAULT '{}'::jsonb,
            palette        JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (room_id, participant_id)
          );

          -- Monotonic client revision: a stale tab or a late sendBeacon can
          -- never overwrite newer answers saved from the device the student
          -- actually resumed on.
          ALTER TABLE cbt.answer_drafts ADD COLUMN IF NOT EXISTS rev BIGINT NOT NULL DEFAULT 0;

          -- Per-question timing (20260804): {position: seconds} accumulated by
          -- the player. Advisory only — it never influences a mark or a rank.
          ALTER TABLE cbt.answer_drafts ADD COLUMN IF NOT EXISTS times JSONB NOT NULL DEFAULT '{}'::jsonb;

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

          -- Per-question timing snapshot (20260804), taken at grading time from
          -- the draft's times map. 0 for every attempt finished before that ship.
          ALTER TABLE cbt.submission_answers
            ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER NOT NULL DEFAULT 0;

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

        // 20260802 CHECK constraints. ADD CONSTRAINT has no IF NOT EXISTS, and
        // re-adding one unconditionally would re-scan the table, so they are
        // guarded by pg_constraint and added NOT VALID — instant, enforced for
        // every new/updated row. The existing-row VALIDATE (plus the two new
        // partial indexes, built CONCURRENTLY) happens online in
        // advanceCbtResilienceBackfill(), which cannot run inside this
        // transaction.
        await client.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'cbt_participants_finalize_reason_check'
            ) THEN
              ALTER TABLE cbt.room_participants
                ADD CONSTRAINT cbt_participants_finalize_reason_check
                CHECK (finalize_reason IS NULL OR finalize_reason IN (
                  'manual', 'timer', 'malpractice', 'expired_offline',
                  'room_closed', 'forced_by_teacher', 'absent')) NOT VALID;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'cbt_rooms_rejoin_policy_check'
            ) THEN
              ALTER TABLE cbt.rooms
                ADD CONSTRAINT cbt_rooms_rejoin_policy_check
                CHECK (rejoin_policy IN ('name_or_id', 'id_only')) NOT VALID;
            END IF;

            -- 20260808: a quota of 0 would mean "blocked forever" (that is what
            -- disabling the teacher is for); NULL is how "no cap" is expressed.
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'cbt_teachers_participation_quota_check'
            ) THEN
              ALTER TABLE cbt.teachers
                ADD CONSTRAINT cbt_teachers_participation_quota_check
                CHECK (participation_quota IS NULL OR participation_quota > 0) NOT VALID;
            END IF;

            -- A renewing mode needs an anchor to renew from; mode 'days' needs
            -- a length.
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint WHERE conname = 'cbt_teachers_quota_reset_check'
            ) THEN
              ALTER TABLE cbt.teachers
                ADD CONSTRAINT cbt_teachers_quota_reset_check
                CHECK (
                  quota_reset_mode IN ('none', 'monthly', 'days')
                  AND (quota_reset_mode = 'none' OR quota_period_anchor IS NOT NULL)
                  AND (quota_reset_mode <> 'days' OR (quota_period_days IS NOT NULL AND quota_period_days > 0))
                ) NOT VALID;
            END IF;
          END $$;
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
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          ["20260802_cbt_attempt_resilience", "cbt attempt resilience columns"],
        );
        await client.query(
          "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          ["20260804_cbt_report_cards", "cbt sectional marking + report cards"],
        );
        // Only the cbt.teachers columns of 20260808 are applied here; the two
        // new tables live in ensureCbtQuotaSchema, which records the receipt.
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

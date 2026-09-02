/**
 * Idempotent runtime ensure for the Origin Weekly Contest + ORBIT schema.
 * Canonical SQL: src/db/migrations/20260819_contest_core.sql
 *
 * Mirrors the migration so an un-migrated dev/preview database self-heals on
 * first use (same safety-net pattern as ensureCbtSchema / ensureCatalogSchema).
 * The SQL below is kept byte-for-byte equivalent to the migration; when the
 * migration changes, update both. Fully isolated in the `contest` schema —
 * never touches cbt.* (plan §5.1).
 *
 * Plan: V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md §2
 */

import type { PoolClient } from "pg";

import { ensureUserSchema } from "@/server/db-users";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originContestSchemaEnsured: boolean | undefined;
  var __originContestSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260819_contest_core";

/**
 * The contest.* DDL, identical to the canonical migration. Idempotent
 * (IF NOT EXISTS throughout), so re-running is a no-op.
 */
const CONTEST_SCHEMA_SQL = `
CREATE SCHEMA IF NOT EXISTS contest;

CREATE TABLE IF NOT EXISTS contest.contests (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  subjects         JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics           JSONB NOT NULL DEFAULT '{}'::jsonb,
  banner_url       TEXT,
  reg_open         TIMESTAMPTZ,
  reg_close        TIMESTAMPTZ,
  start_at         TIMESTAMPTZ,
  end_at           TIMESTAMPTZ,
  display_tz       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  duration_seconds INTEGER,
  scoring_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ogcode_reward    INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','result_processing','result_published','archived','cancelled')),
  created_by       TEXT REFERENCES origin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contests_status_start
  ON contest.contests(status, start_at);

-- Idempotently widen the status CHECK to include 'cancelled' (self-heals a DB
-- created before 20260819_contest_cancelled_status.sql). No-op on fresh tables.
ALTER TABLE contest.contests DROP CONSTRAINT IF EXISTS contests_status_check;
ALTER TABLE contest.contests
  ADD CONSTRAINT contests_status_check
  CHECK (status IN ('draft','scheduled','result_processing','result_published','archived','cancelled'));

CREATE TABLE IF NOT EXISTS contest.contest_questions (
  contest_id     TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  question_id    TEXT NOT NULL,
  subject        TEXT,
  section_id     TEXT,
  snapshot       JSONB NOT NULL,
  marks          DOUBLE PRECISION,
  negative_marks DOUBLE PRECISION,
  PRIMARY KEY (contest_id, position)
);

CREATE TABLE IF NOT EXISTS contest.registrations (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_registrations_user
  ON contest.registrations(user_id, registered_at DESC);

-- Access & eligibility (Phase 5). access_mode gates who may register:
--   'open'    — anyone (default; unchanged behaviour)
--   'code'    — a valid, unused access code is required
--   'premium' — an active premium entitlement is required
-- registration_cap caps confirmed seats (NULL = unlimited); overflow within the
-- window goes to the waitlist (registrations.status = 'waitlisted').
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'open'
  CHECK (access_mode IN ('open','code','premium'));
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS registration_cap INTEGER;

-- Registration status: confirmed 'registered' or 'waitlisted' (promoted FIFO as
-- seats free up). Existing rows default to 'registered' (the historical state).
ALTER TABLE contest.registrations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'registered'
  CHECK (status IN ('registered','waitlisted'));
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist
  ON contest.registrations(contest_id, status, registered_at);

-- Per-contest access codes (access_mode = 'code'). Single-use: redeemed_by is
-- stamped on redemption; a code is valid only while unredeemed.
CREATE TABLE IF NOT EXISTS contest.access_codes (
  contest_id   TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  redeemed_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  redeemed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, code)
);
CREATE INDEX IF NOT EXISTS idx_access_codes_contest ON contest.access_codes(contest_id);

CREATE TABLE IF NOT EXISTS contest.attempts (
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  registered_at      TIMESTAMPTZ,
  started_at         TIMESTAMPTZ,
  finished_at        TIMESTAMPTZ,
  auto_submitted     BOOLEAN NOT NULL DEFAULT false,
  finalize_reason    TEXT CHECK (finalize_reason IN ('manual','auto','deadline')),
  violation_count    INTEGER NOT NULL DEFAULT 0,
  review_status      TEXT NOT NULL DEFAULT 'none'
                       CHECK (review_status IN ('none','flagged','cleared','upheld')),
  score              DOUBLE PRECISION,
  correct_count      INTEGER,
  incorrect_count    INTEGER,
  unattempted_count  INTEGER,
  time_taken_seconds INTEGER,
  section_scores     JSONB,
  eligibility        BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_rank
  ON contest.attempts(contest_id, score DESC, time_taken_seconds ASC, registered_at ASC, user_id);

CREATE TABLE IF NOT EXISTS contest.answer_drafts (
  contest_id  TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  answers     JSONB NOT NULL DEFAULT '{}'::jsonb,
  palette     JSONB NOT NULL DEFAULT '{}'::jsonb,
  times       JSONB NOT NULL DEFAULT '{}'::jsonb,
  rev         BIGINT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
) PARTITION BY LIST (contest_id);

CREATE TABLE IF NOT EXISTS contest.answer_drafts_default
  PARTITION OF contest.answer_drafts DEFAULT;

CREATE TABLE IF NOT EXISTS contest.submission_answers (
  contest_id        TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  position          INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  question_snapshot JSONB NOT NULL,
  submitted_answer  JSONB,
  is_correct        BOOLEAN,
  marks_awarded     DOUBLE PRECISION,
  time_spent_seconds INTEGER,
  PRIMARY KEY (contest_id, user_id, position)
) PARTITION BY LIST (contest_id);

CREATE TABLE IF NOT EXISTS contest.submission_answers_default
  PARTITION OF contest.submission_answers DEFAULT;

CREATE TABLE IF NOT EXISTS contest.leaderboard_snapshot (
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  rank               INTEGER NOT NULL,
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  score              DOUBLE PRECISION NOT NULL,
  time_taken_seconds INTEGER,
  registered_at      TIMESTAMPTZ,
  percentile         DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (contest_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshot_user
  ON contest.leaderboard_snapshot(contest_id, user_id);

CREATE TABLE IF NOT EXISTS contest.orbit_ratings (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  current_rating  DOUBLE PRECISION NOT NULL DEFAULT 1000,
  rd              DOUBLE PRECISION NOT NULL DEFAULT 350,
  volatility      DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  games_played    INTEGER NOT NULL DEFAULT 0,
  previous_rating DOUBLE PRECISION,
  highest_rating  DOUBLE PRECISION,
  lowest_rating   DOUBLE PRECISION,
  rating_change   DOUBLE PRECISION,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest.orbit_history (
  user_id            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  contest_id         TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  rating_before      DOUBLE PRECISION,
  rating_after       DOUBLE PRECISION,
  rd_before          DOUBLE PRECISION,
  rd_after           DOUBLE PRECISION,
  volatility_before  DOUBLE PRECISION,
  volatility_after   DOUBLE PRECISION,
  rating_change      DOUBLE PRECISION,
  rank               INTEGER,
  percentile         DOUBLE PRECISION,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contest_id)
);

CREATE TABLE IF NOT EXISTS contest.reward_ledger (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  ogcode_points INTEGER NOT NULL,
  awarded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS contest.practice_progress (
  contest_id      TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  per_subject     JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);

CREATE TABLE IF NOT EXISTS contest.streaks (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  current_streak  INTEGER NOT NULL DEFAULT 0,
  longest_streak  INTEGER NOT NULL DEFAULT 0,
  last_contest_id TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest.badges (
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  badge      TEXT NOT NULL,
  contest_id TEXT REFERENCES contest.contests(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);

CREATE TABLE IF NOT EXISTS contest.personal_bests (
  user_id         TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  highest_orbit   DOUBLE PRECISION,
  best_rank       INTEGER,
  best_percentile DOUBLE PRECISION,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest.reminders_sent (
  contest_id    TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reminder_kind TEXT NOT NULL
                  CHECK (reminder_kind IN ('confirmation','t_24h','t_1h','t_10m','results')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id, reminder_kind)
);

-- Per-event partition management + retention (mirrors 20260821_contest_partitions.sql).
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS drafts_purged_at TIMESTAMPTZ;
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION contest._partition_name(base text, cid text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT base || '_p_' || substr(md5(cid), 1, 16)
$fn$;

CREATE OR REPLACE FUNCTION contest.ensure_event_partitions(cid text)
RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  dpart text := contest._partition_name('answer_drafts', cid);
  spart text := contest._partition_name('submission_answers', cid);
BEGIN
  IF to_regclass(format('contest.%I', dpart)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE contest.%I PARTITION OF contest.answer_drafts FOR VALUES IN (%L)',
      dpart, cid);
  END IF;
  IF to_regclass(format('contest.%I', spart)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE contest.%I PARTITION OF contest.submission_answers FOR VALUES IN (%L)',
      spart, cid);
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION contest.drop_event_partition(base text, cid text)
RETURNS boolean
LANGUAGE plpgsql AS $fn$
DECLARE
  part text;
BEGIN
  IF base NOT IN ('answer_drafts', 'submission_answers') THEN
    RAISE EXCEPTION 'drop_event_partition: unsupported base %', base;
  END IF;
  part := contest._partition_name(base, cid);
  IF to_regclass(format('contest.%I', part)) IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE format('DROP TABLE contest.%I', part);
  RETURN true;
END;
$fn$;

-- Public sanitized share links (mirrors 20260823_contest_share_links.sql).
CREATE TABLE IF NOT EXISTS contest.share_links (
  slug        TEXT PRIMARY KEY,
  contest_id  TEXT NOT NULL REFERENCES contest.contests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

-- Recurring schedules (mirrors 20260823_contest_schedules.sql).
CREATE TABLE IF NOT EXISTS contest.schedules (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  subjects         JSONB NOT NULL DEFAULT '[]'::jsonb,
  topics           JSONB NOT NULL DEFAULT '{}'::jsonb,
  selections       JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_minutes INTEGER NOT NULL,
  reg_lead_days    INTEGER NOT NULL DEFAULT 5,
  cadence_days     INTEGER NOT NULL DEFAULT 7,
  scoring_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ogcode_reward    INTEGER NOT NULL DEFAULT 0,
  display_tz       TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  next_start_at    TIMESTAMPTZ NOT NULL,
  run_count        INTEGER NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT true,
  last_contest_id  TEXT,
  created_by       TEXT REFERENCES origin_users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contest_schedules_due ON contest.schedules(active, next_start_at);

-- Per-admin synthetic workspace bridge for Contest document-import. Mirrors the
-- CBT import-workspace trick: the shared import.document_import_jobs table FKs
-- workspace_id into app.teacher_workspaces, so an admin importing questions for
-- a contest needs a workspace they own. We create one hidden personal workspace
-- per admin ([CONTEST] <email>) and cache its id here. Per-admin (not a
-- singleton) because createImportJob requires the acting admin to hold an
-- owner membership on the workspace.
CREATE TABLE IF NOT EXISTS contest.admin_import_workspaces (
  user_id      TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Student bookmarks on contest questions (Phase 6 improvement loop). A user can
-- save a question from a completed contest's review to revisit later. The
-- question snapshot is copied in so a bookmark survives independent of the
-- contest paper.
CREATE TABLE IF NOT EXISTS contest.question_bookmarks (
  user_id           TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  contest_id        TEXT NOT NULL,
  position          INTEGER NOT NULL,
  question_id       TEXT NOT NULL,
  question_snapshot JSONB NOT NULL,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, contest_id, position)
);
CREATE INDEX IF NOT EXISTS idx_contest_bookmarks_user ON contest.question_bookmarks(user_id, created_at DESC);
`;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "contest + orbit foundation"],
  );
}

/**
 * Ensures the contest.* schema exists. Cached per-process so it runs at most
 * once. No-ops when USER_DATABASE_URL is unconfigured (local builds/previews
 * with no database attached), matching ensureCbtSchema's contract.
 */
export async function ensureContestSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originContestSchemaEnsured) return;
  if (!globalThis.__originContestSchemaPromise) {
    globalThis.__originContestSchemaPromise = (async () => {
      // origin_users + app.migrations must exist before contest.* FKs resolve.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        await client.query(CONTEST_SCHEMA_SQL);
        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originContestSchemaEnsured = true;
      } catch (err) {
        await client.query("ROLLBACK");
        globalThis.__originContestSchemaPromise = undefined;
        throw err;
      } finally {
        client.release();
      }
    })();
  }
  return globalThis.__originContestSchemaPromise;
}

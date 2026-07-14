-- CBT Platform (o3origin.com/cbt) — foundation schema.
-- Mirrors the runtime-ensure module src/server/cbt/cbt-schema.ts.
-- See CBT_implementation.md (Phase 1).
--
-- Two parts:
--   1. Widen origin_users.role CHECK to add the new 'cbt_teacher' literal.
--      This CHECK is SHARED with main Origin, so it is applied here as an
--      idempotent DROP + re-ADD. The handleRegister role whitelist fix
--      (src/legacy/users.ts) ships in the SAME commit so public signup can
--      never mint a cbt_teacher once this widening lands.
--   2. Create the dedicated cbt.* schema (all CBT data lives here, in the
--      USER database pool — no joins into Origin student/analytics data).

-- 1. Widen the origin_users role CHECK (idempotent).
DO $$
BEGIN
  ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_role_check;
  ALTER TABLE origin_users
    ADD CONSTRAINT origin_users_role_check
    CHECK (role IN ('student', 'teacher', 'admin', 'cbt_teacher'));
END $$;

-- 2. CBT schema.
CREATE SCHEMA IF NOT EXISTS cbt;

-- cbt.teachers — the allowlist. One row per eligible teacher email. user_id is
-- NULL until the teacher first logs in (then linked to their origin_users row).
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

-- cbt.login_otps — dedicated OTP store for the CBT login flow (hashed codes).
CREATE TABLE IF NOT EXISTS cbt.login_otps (
  email        TEXT PRIMARY KEY,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at  TIMESTAMPTZ
);

-- cbt.questions — teacher-scoped question bank (single table, no versioning).
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

-- cbt.tests — assembled tests. Only 'ready' tests can be attached to rooms.
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

-- cbt.test_questions — ordered questions in a test. ON DELETE RESTRICT protects
-- a question that is in use by a test (friendly error surfaced by the service).
CREATE TABLE IF NOT EXISTS cbt.test_questions (
  test_id        TEXT NOT NULL REFERENCES cbt.tests(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,
  question_id    TEXT NOT NULL REFERENCES cbt.questions(id) ON DELETE RESTRICT,
  marks          DOUBLE PRECISION NOT NULL DEFAULT 4,
  negative_marks DOUBLE PRECISION NOT NULL DEFAULT -1,
  PRIMARY KEY (test_id, position)
);

-- cbt.rooms — one room = one unguessable public_slug + one human code (hashed).
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

-- cbt.room_participants — anonymous students. id IS the participant_id embedded
-- in the signed participant token. No origin_users rows are ever created.
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

-- cbt.answer_drafts — server-held incremental autosave (source of truth for
-- resume + grading). One row per (room, participant).
CREATE TABLE IF NOT EXISTS cbt.answer_drafts (
  room_id        TEXT NOT NULL REFERENCES cbt.rooms(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES cbt.room_participants(id) ON DELETE CASCADE,
  answers        JSONB NOT NULL DEFAULT '{}'::jsonb,
  palette        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, participant_id)
);

-- cbt.submission_answers — graded, per-question submission record.
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

-- Indexes. (public_slug already has a unique-constraint index, so no explicit
-- duplicate is created for it.)
CREATE INDEX IF NOT EXISTS idx_cbt_rooms_teacher ON cbt.rooms (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_participants_room_seen ON cbt.room_participants (room_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_cbt_questions_teacher ON cbt.questions (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_tests_teacher ON cbt.tests (teacher_id);

INSERT INTO app.migrations (id, name)
VALUES ('20260705_cbt_module', 'cbt module foundation')
ON CONFLICT (id) DO NOTHING;

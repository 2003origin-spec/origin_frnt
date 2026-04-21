-- ORIGIN user/auth/task schema
-- Run against USER_DATABASE_URL to activate Postgres-backed storage.
-- The app falls back to the flat-file store when this database is not configured.

CREATE TABLE IF NOT EXISTS origin_users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  student_class TEXT,
  field_of_interest TEXT,
  referral_source TEXT,
  avatar        TEXT,
  streak        INTEGER NOT NULL DEFAULT 0,
  total_study_time INTEGER NOT NULL DEFAULT 0,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
  premium_expiry TIMESTAMPTZ,
  is_onboarded  BOOLEAN NOT NULL DEFAULT FALSE,
  selected_course TEXT,
  is_dropper    BOOLEAN NOT NULL DEFAULT FALSE,
  years_of_experience TEXT,
  subjects      TEXT[] NOT NULL DEFAULT '{}',
  student_capacity TEXT,
  UNIQUE (email, role)
);

CREATE TABLE IF NOT EXISTS origin_auth_sessions (
  access_token              TEXT PRIMARY KEY,
  refresh_token             TEXT NOT NULL UNIQUE,
  user_id                   TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_token_expires_at   TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh  ON origin_auth_sessions (refresh_token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user     ON origin_auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS origin_tasks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT FALSE,
  due        TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category   TEXT,
  priority   TEXT CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_user ON origin_tasks (user_id);

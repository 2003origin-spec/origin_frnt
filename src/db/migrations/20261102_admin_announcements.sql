-- Admin announcements (Admin → Announcements): one row per send, tests included. USER database. Idempotent + additive.
-- Mirrored at runtime by ensureAnnouncementsSchema() (src/server/announcements/schema.ts);
-- tests/unit/announcements-schema.test.ts keeps the two identical.
-- NOT in the prebuild allowlist (scripts/run-migrations.mjs), same as messaging / Notes / Origin NOW:
-- prod gets it the first time the admin page is used, or run this file by hand on Neon.
-- The in-app notifications themselves go to app.notifications (unchanged).

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.announcements (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 65),
  body           TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 240),
  link           TEXT NOT NULL DEFAULT '/' CHECK (char_length(link) BETWEEN 1 AND 200 AND left(link, 1) = '/'),
  audience       JSONB NOT NULL,
  sent_by        TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  test           BOOLEAN NOT NULL DEFAULT false,
  recipients     INTEGER NOT NULL DEFAULT 0 CHECK (recipients >= 0),
  push_attempted INTEGER NOT NULL DEFAULT 0 CHECK (push_attempted >= 0),
  push_delivered INTEGER NOT NULL DEFAULT 0 CHECK (push_delivered >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS app_announcements_created_idx ON app.announcements (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS app_announcements_sender_idx ON app.announcements (sent_by, created_at DESC);

CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app.migrations (id, name)
  VALUES ('20261102_admin_announcements', 'admin announcements — app.announcements send log')
  ON CONFLICT (id) DO NOTHING;

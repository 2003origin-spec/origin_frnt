-- Student messaging (student-to-student, request-gated, daily unit cap). USER database. Idempotent + additive.
-- Mirrored at runtime by ensureMessagingSchema() (src/server/messaging/schema.ts);
-- tests/unit/messaging-schema.test.ts keeps the two identical.
-- NOT in the prebuild allowlist (scripts/run-migrations.mjs), same as Notes / Origin NOW:
-- prod gets it on first use, or run this file by hand on Neon before turning
-- TEACHER_LAUNCH_STUDENT_MESSAGING on.

CREATE SCHEMA IF NOT EXISTS messaging;

CREATE TABLE IF NOT EXISTS messaging.conversations (
  id              TEXT PRIMARY KEY,
  user_a          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  user_b          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  requested_by    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','blocked')),
  blocked_by      TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  blocked_at      TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  CHECK (user_a < user_b),
  CHECK (requested_by IN (user_a, user_b)),
  UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS messaging_conversations_a_idx ON messaging.conversations (user_a, updated_at DESC);

CREATE INDEX IF NOT EXISTS messaging_conversations_b_idx ON messaging.conversations (user_b, updated_at DESC);

CREATE TABLE IF NOT EXISTS messaging.members (
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT to_timestamp(0),
  notice_pending  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS messaging_members_user_idx ON messaging.members (user_id);

CREATE TABLE IF NOT EXISTS messaging.messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  units           SMALLINT NOT NULL CHECK (units >= 1),
  ist_day         DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messaging_messages_conversation_idx
  ON messaging.messages (conversation_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS messaging_messages_sender_day_idx ON messaging.messages (sender_id, ist_day);

CREATE TABLE IF NOT EXISTS messaging.daily_usage (
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  ist_day    DATE NOT NULL,
  units      INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ist_day)
);

CREATE TABLE IF NOT EXISTS messaging.blocks (
  blocker_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS messaging_blocks_blocked_idx ON messaging.blocks (blocked_id);

CREATE TABLE IF NOT EXISTS messaging.reports (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  reporter_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reported_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  reason          TEXT NOT NULL CHECK (reason IN ('spam','abuse','inappropriate','other')),
  note            TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT REFERENCES origin_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS messaging_reports_status_idx ON messaging.reports (status, created_at DESC);

-- Addendum 02/11/2026: unblock restores the status a block replaced; admins
-- resolve reports (dismiss / warn / suspend); suspensions pause sending.
ALTER TABLE messaging.conversations ADD COLUMN IF NOT EXISTS status_before_block TEXT
  CHECK (status_before_block IN ('pending','accepted','declined'));

ALTER TABLE messaging.reports ADD COLUMN IF NOT EXISTS resolution TEXT
  CHECK (resolution IN ('dismiss','warn','suspend'));

ALTER TABLE messaging.reports ADD COLUMN IF NOT EXISTS resolution_note TEXT
  CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000);

CREATE TABLE IF NOT EXISTS messaging.suspensions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  report_id  TEXT REFERENCES messaging.reports(id) ON DELETE SET NULL,
  starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at    TIMESTAMPTZ NOT NULL,
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  created_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS messaging_suspensions_user_idx ON messaging.suspensions (user_id, ends_at DESC);

CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app.migrations (id, name)
  VALUES ('20261101_student_messaging', 'student messaging — requests, messages, daily units, blocks, reports, suspensions')
  ON CONFLICT (id) DO NOTHING;

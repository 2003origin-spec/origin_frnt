-- Origin Notes — shared library (Phase 1), My Notes (Phase 3) and sharing (Phase 4). USER database. Idempotent + additive.
-- Mirrored at runtime by ensureNotesSchema() (src/server/notes/notes-schema.ts);
-- tests/notes/notes-schema.test.ts keeps the two identical.
-- NOT in the prebuild allowlist (scripts/run-migrations.mjs), same as Origin NOW:
-- prod gets it on first use, or run this file by hand on Neon before launch.
-- Plan: V1/NOTES_PLAN.md §6.

CREATE SCHEMA IF NOT EXISTS notes;

CREATE TABLE IF NOT EXISTS notes.folders (
  id            TEXT PRIMARY KEY,
  parent_id     TEXT REFERENCES notes.folders(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  kind          TEXT NOT NULL DEFAULT 'folder' CHECK (kind IN ('class','subject','chapter','folder')),
  class_level   SMALLINT CHECK (class_level IN (9,10,11,12)),
  subject       TEXT CHECK (subject IN ('physics','chemistry','mathematics','biology')),
  syllabus_key  TEXT UNIQUE,
  ncert_number  SMALLINT CHECK (ncert_number BETWEEN 1 AND 40),
  bank_chapters TEXT[] NOT NULL DEFAULT '{}',
  exams         TEXT[] NOT NULL DEFAULT '{}',
  access        TEXT NOT NULL DEFAULT 'inherit' CHECK (access IN ('inherit','free','premium')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  deleted_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS notes_folders_sibling_name_uq
  ON notes.folders (COALESCE(parent_id, ''), lower(name)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_folders_parent_idx
  ON notes.folders (parent_id, sort_order) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notes.items (
  id            TEXT PRIMARY KEY,
  folder_id     TEXT NOT NULL REFERENCES notes.folders(id) ON DELETE RESTRICT,
  kind          TEXT NOT NULL CHECK (kind IN ('typed','pdf','image')),
  note_type     TEXT NOT NULL DEFAULT 'other' CHECK (note_type IN ('formula_sheet','short_notes','key_points','practice','other')),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body_md       TEXT CHECK (body_md IS NULL OR char_length(body_md) <= 200000),
  body_text     TEXT,
  file_key      TEXT,
  mime          TEXT,
  bytes         BIGINT CHECK (bytes IS NULL OR bytes >= 0),
  page_count    INTEGER CHECK (page_count IS NULL OR page_count >= 0),
  original_name TEXT,
  access        TEXT NOT NULL DEFAULT 'inherit' CHECK (access IN ('inherit','free','premium')),
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','published')),
  source        TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','import')),
  external_key  TEXT UNIQUE,
  import_hash   TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  reviewer_name TEXT,
  reviewed_by   TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  updated_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  deleted_by    TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  CHECK ((kind = 'typed' AND body_md IS NOT NULL) OR (kind <> 'typed' AND file_key IS NOT NULL AND mime IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS notes_items_folder_idx
  ON notes.items (folder_id, sort_order) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_items_status_idx
  ON notes.items (status, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notes.item_revisions (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL REFERENCES notes.items(id) ON DELETE CASCADE,
  version    INTEGER NOT NULL,
  title      TEXT NOT NULL,
  body_md    TEXT,
  edited_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, version)
);

CREATE TABLE IF NOT EXISTS notes.stars (
  user_id    TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL REFERENCES notes.items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS notes.views (
  user_id         TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  item_id         TEXT NOT NULL REFERENCES notes.items(id) ON DELETE CASCADE,
  view_count      INTEGER NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS notes_views_recent_idx ON notes.views (user_id, last_viewed_at DESC);

CREATE INDEX IF NOT EXISTS notes_views_item_idx ON notes.views (item_id);

CREATE TABLE IF NOT EXISTS notes.reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('library_item','shared_file')),
  target_id       TEXT NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN ('mistake','unclear','broken','other','inappropriate','copyright','spam')),
  message         TEXT CHECK (message IS NULL OR char_length(message) <= 1000),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution_note TEXT,
  resolved_by     TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  share_id        TEXT
);

CREATE INDEX IF NOT EXISTS notes_reports_status_idx ON notes.reports (status, created_at DESC);

CREATE TABLE IF NOT EXISTS notes.uploads (
  id             TEXT PRIMARY KEY,
  scope          TEXT NOT NULL CHECK (scope IN ('library','personal')),
  user_id        TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  folder_id      TEXT,
  upload_key     TEXT NOT NULL,
  final_key      TEXT,
  declared_mime  TEXT NOT NULL,
  declared_bytes BIGINT NOT NULL CHECK (declared_bytes > 0),
  original_name  TEXT NOT NULL,
  title          TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','rejected','expired')),
  reject_reason  TEXT,
  result_id      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  cleared_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notes_uploads_pending_idx ON notes.uploads (expires_at) WHERE status = 'pending';
ALTER TABLE notes.uploads ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS notes_uploads_uncleared_idx ON notes.uploads (expires_at) WHERE cleared_at IS NULL;

CREATE TABLE IF NOT EXISTS notes.my_folders (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  parent_id     TEXT REFERENCES notes.my_folders(id),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  deleted_batch TEXT,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS notes_my_folders_sibling_name_uq
  ON notes.my_folders (owner_id, COALESCE(parent_id, ''), lower(name)) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_my_folders_bin_idx
  ON notes.my_folders (owner_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS notes.my_files (
  id            TEXT PRIMARY KEY,
  owner_id      TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  folder_id     TEXT REFERENCES notes.my_folders(id),
  kind          TEXT NOT NULL CHECK (kind IN ('typed','pdf','image','office','audio','video')),
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  original_name TEXT,
  body_md       TEXT CHECK (body_md IS NULL OR char_length(body_md) <= 200000),
  file_key      TEXT,
  mime          TEXT,
  bytes         BIGINT NOT NULL DEFAULT 0 CHECK (bytes >= 0),
  page_count    INTEGER CHECK (page_count IS NULL OR page_count >= 0),
  duration_s    INTEGER CHECK (duration_s IS NULL OR duration_s >= 0),
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  deleted_batch TEXT,
  CHECK ((kind = 'typed' AND body_md IS NOT NULL) OR (kind <> 'typed' AND file_key IS NOT NULL AND mime IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS notes_my_files_folder_idx
  ON notes.my_files (owner_id, folder_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_my_files_bin_idx
  ON notes.my_files (owner_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS notes_my_folders_parent_idx ON notes.my_folders (parent_id);
CREATE INDEX IF NOT EXISTS notes_my_folders_owner_batch_idx ON notes.my_folders (owner_id, deleted_batch);
CREATE INDEX IF NOT EXISTS notes_my_files_folder_all_idx ON notes.my_files (folder_id);
CREATE INDEX IF NOT EXISTS notes_my_files_owner_batch_idx ON notes.my_files (owner_id, deleted_batch);

CREATE TABLE IF NOT EXISTS notes.storage (
  user_id              TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  used_bytes           BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  reserved_bytes       BIGINT NOT NULL DEFAULT 0 CHECK (reserved_bytes >= 0),
  limit_override_bytes BIGINT CHECK (limit_override_bytes IS NULL OR limit_override_bytes >= 0),
  override_reason      TEXT,
  override_by          TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  uploads_blocked      BOOLEAN NOT NULL DEFAULT false,
  sharing_blocked      BOOLEAN NOT NULL DEFAULT false,
  block_reason         TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes.shares (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('file','folder')),
  target_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ,
  revoked_by   TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  CHECK (owner_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS notes_shares_active_uq
  ON notes.shares (target_type, target_id, recipient_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_shares_recipient_idx
  ON notes.shares (recipient_id, created_at DESC) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS notes_shares_owner_idx ON notes.shares (owner_id, created_at DESC);

ALTER TABLE notes.reports ADD COLUMN IF NOT EXISTS share_id TEXT;

CREATE TABLE IF NOT EXISTS notes.library_state (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  version    BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO notes.library_state (id, version) VALUES (TRUE, 0) ON CONFLICT (id) DO NOTHING;

CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app.migrations (id, name)
VALUES ('20261018_notes_core', 'origin notes — shared library, my notes and sharing')
ON CONFLICT (id) DO NOTHING;

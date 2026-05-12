ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS location TEXT;

CREATE TABLE IF NOT EXISTS origin_media_assets (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  purpose          TEXT NOT NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  bucket           TEXT NOT NULL,
  object_key       TEXT NOT NULL UNIQUE,
  public_url       TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  size_bytes       INTEGER NOT NULL CHECK (size_bytes > 0),
  sha256           TEXT NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_user_purpose_created
  ON origin_media_assets (user_id, purpose, created_at DESC);

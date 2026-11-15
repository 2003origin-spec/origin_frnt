-- Study Music (V1/STUDY_MUSIC_PLAN.md §4.4): licensed focus-music tracks, per-user prefs and
-- listening sessions. USER database. Idempotent + additive.
-- Mirrored at runtime by ensureMusicSchema() (src/server/music/schema.ts);
-- tests/unit/study-music-schema.test.ts keeps the two identical.
-- NOT in the prebuild allowlist (scripts/run-migrations.mjs), same as announcements / Notes / Origin NOW:
-- prod gets it the first time /admin/music or a music API is used, or run this file by hand on Neon.
-- Audio and licence-proof files live in the PRIVATE R2 bucket under music/; this file holds no audio.

CREATE SCHEMA IF NOT EXISTS music;

CREATE TABLE IF NOT EXISTS music.tracks (
  id                   UUID PRIMARY KEY,
  title                TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  artist               TEXT NOT NULL CHECK (char_length(artist) BETWEEN 1 AND 80),
  mood                 TEXT NOT NULL CHECK (mood IN ('lofi','instrumental','nature','white_noise')),
  duration_seconds     INTEGER NOT NULL CHECK (duration_seconds BETWEEN 20 AND 1200),
  loopable             BOOLEAN NOT NULL DEFAULT false,
  allow_offline        BOOLEAN NOT NULL DEFAULT true,
  object_key           TEXT NOT NULL UNIQUE,
  mime_type            TEXT NOT NULL CHECK (mime_type IN ('audio/mp4','audio/mpeg')),
  size_bytes           BIGINT NOT NULL CHECK (size_bytes BETWEEN 1 AND 15728640),
  sha256               TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  source_url           TEXT NOT NULL CHECK (source_url ~ '^https://' AND char_length(source_url) <= 500),
  licence_name         TEXT NOT NULL CHECK (char_length(licence_name) BETWEEN 1 AND 80),
  licence_url          TEXT NOT NULL CHECK (licence_url ~ '^https://' AND char_length(licence_url) <= 500),
  attribution_required BOOLEAN NOT NULL DEFAULT true,
  attribution_text     TEXT NOT NULL CHECK (char_length(attribution_text) BETWEEN 1 AND 300),
  licence_proof_key    TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_by           TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS music_tracks_published_idx ON music.tracks (mood, sort_order) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS music.user_prefs (
  user_id            TEXT PRIMARY KEY REFERENCES origin_users(id) ON DELETE CASCADE,
  pause_during_tests BOOLEAN NOT NULL DEFAULT true,
  default_mood       TEXT NOT NULL DEFAULT 'lofi' CHECK (default_mood IN ('lofi','instrumental','nature','white_noise')),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS music.listen_sessions (
  id            UUID PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  track_id      UUID NOT NULL REFERENCES music.tracks(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('web','android')),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  seconds       INTEGER NOT NULL DEFAULT 0 CHECK (seconds >= 0),
  focus_seconds INTEGER NOT NULL DEFAULT 0 CHECK (focus_seconds >= 0 AND focus_seconds <= seconds),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS music_listen_user_day_idx ON music.listen_sessions (user_id, started_at);

CREATE TABLE IF NOT EXISTS app.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app.migrations (id, name)
  VALUES ('20261114_study_music', 'study music — music.tracks, user_prefs, listen_sessions')
  ON CONFLICT (id) DO NOTHING;

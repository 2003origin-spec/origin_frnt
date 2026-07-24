-- Durable admin platform settings — app.platform_settings (tiny KV store).
-- Backs the Feature-A support phone (teacher_code_support_phone) and the
-- Feature-B re-signup toggle (allow_deleted_identity_resignup). Additive +
-- idempotent. Mirrors src/server/platform-settings.ts (runtime-ensure), so
-- production self-applies this on first use — no manual migration step.
-- See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app.migrations (id, name)
VALUES ('20260724_platform_settings', 'durable admin platform settings — app.platform_settings')
ON CONFLICT (id) DO NOTHING;

COMMIT;

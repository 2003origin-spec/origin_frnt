-- Admin user lifecycle (Feature B). Adds origin_users.account_status (+ audit
-- columns) and app.deleted_identity_blocklist. Additive + idempotent. Mirrors
-- ensureUserSchema (columns, src/server/db-users.ts) + user-lifecycle-store.ts
-- (blocklist), so production self-applies on first use — no manual migration.
-- DEFAULT 'active' backfills every existing user. Enforcement (login gating +
-- re-signup block) is UNCONDITIONAL — it always respects these regardless of the
-- adminUserLifecycle flag. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.

BEGIN;

ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS status_changed_by TEXT;
CREATE INDEX IF NOT EXISTS idx_origin_users_account_status ON origin_users (account_status);

DO $$ BEGIN
  ALTER TABLE origin_users ADD CONSTRAINT origin_users_account_status_check
    CHECK (account_status IN ('active','revoked','deleted'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.deleted_identity_blocklist (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  email_norm  TEXT,
  mobile_norm TEXT,
  reason      TEXT,
  deleted_by  TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deleted_blocklist_email
  ON app.deleted_identity_blocklist(email_norm) WHERE email_norm IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deleted_blocklist_mobile
  ON app.deleted_identity_blocklist(mobile_norm) WHERE mobile_norm IS NOT NULL;

INSERT INTO app.migrations (id, name)
VALUES ('20260724_user_lifecycle', 'admin user lifecycle — account_status + deleted_identity_blocklist')
ON CONFLICT (id) DO NOTHING;

COMMIT;

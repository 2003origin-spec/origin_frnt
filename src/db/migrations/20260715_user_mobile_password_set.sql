-- First-time onboarding: unique student mobile number + a flag for whether the
-- user has set their own password (Google signups start false and set it during
-- onboarding). USER pool (origin_users). Mirrored by the runtime-ensure in
-- src/server/db-users.ts. Idempotent + additive; safe to re-run.

ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT TRUE;

-- Unique only among rows that have a mobile, so existing null rows never collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_origin_users_mobile
  ON origin_users (mobile) WHERE mobile IS NOT NULL;

-- Forgot-password email OTPs (USER pool). One row per (email, role); the code is
-- stored only as a SHA-256 hash. Mirrored by the runtime-ensure in
-- src/server/password-reset.ts. Idempotent + additive; safe to re-run.

CREATE TABLE IF NOT EXISTS origin_password_reset_otps (
  email        TEXT NOT NULL,
  role         TEXT NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (email, role)
);

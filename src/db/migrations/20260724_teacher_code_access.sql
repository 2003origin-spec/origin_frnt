-- Admin-gated teacher code access (Feature A). Adds the "live grant" columns to
-- app.teacher_workspaces (read at redeem time) and the app.teacher_code_requests
-- request/approval ledger. Additive + idempotent. Mirrors
-- src/server/workspaces/code-access-schema.ts (runtime-ensure), so production
-- self-applies this on first use — no manual migration step.
--
-- Grandfather rule: code_access_status DEFAULT 'legacy' backfills every existing
-- workspace, and student_quota stays NULL, so quota enforcement (which only runs
-- when student_quota IS NOT NULL) never disrupts live teachers until an admin
-- grants a quota. See V1/allmd/TEACHER_CODE_ACCESS_AND_USER_LIFECYCLE_PLAN.md.

BEGIN;

ALTER TABLE app.teacher_workspaces
  ADD COLUMN IF NOT EXISTS code_access_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE app.teacher_workspaces
  ADD COLUMN IF NOT EXISTS student_quota INT;
ALTER TABLE app.teacher_workspaces
  ADD COLUMN IF NOT EXISTS code_ai_access BOOLEAN;

DO $$ BEGIN
  ALTER TABLE app.teacher_workspaces
    ADD CONSTRAINT teacher_workspaces_code_access_status_check
    CHECK (code_access_status IN
      ('legacy','none','requested','granted','quota_filled','revoked'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS app.teacher_code_requests (
  id                      TEXT PRIMARY KEY,
  workspace_id            TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  requested_by            TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
  requested_student_count INT NOT NULL CHECK (requested_student_count > 0),
  ai_access               BOOLEAN NOT NULL DEFAULT FALSE,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','cancelled')),
  granted_quota           INT,
  granted_code_id         TEXT REFERENCES app.workspace_codes(id) ON DELETE SET NULL,
  admin_note              TEXT,
  decided_by              TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  decided_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_code_requests_status
  ON app.teacher_code_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teacher_code_requests_workspace
  ON app.teacher_code_requests(workspace_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_code_request_pending
  ON app.teacher_code_requests(workspace_id) WHERE status = 'pending';

INSERT INTO app.migrations (id, name)
VALUES ('20260724_teacher_code_access',
        'admin-gated teacher code access — workspace columns + teacher_code_requests')
ON CONFLICT (id) DO NOTHING;

COMMIT;

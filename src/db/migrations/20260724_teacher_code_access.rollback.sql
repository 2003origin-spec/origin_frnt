-- Rollback for 20260724_teacher_code_access.sql. Drops the request ledger and
-- the workspace grant columns. Note: dropping student_quota disables all quota
-- enforcement (fail-open to the pre-feature "unlimited" behaviour), which is the
-- intended safe rollback.

BEGIN;

DROP TABLE IF EXISTS app.teacher_code_requests;

ALTER TABLE app.teacher_workspaces
  DROP CONSTRAINT IF EXISTS teacher_workspaces_code_access_status_check;
ALTER TABLE app.teacher_workspaces DROP COLUMN IF EXISTS code_access_status;
ALTER TABLE app.teacher_workspaces DROP COLUMN IF EXISTS student_quota;
ALTER TABLE app.teacher_workspaces DROP COLUMN IF EXISTS code_ai_access;

DELETE FROM app.migrations WHERE id = '20260724_teacher_code_access';

COMMIT;

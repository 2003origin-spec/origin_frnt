-- Rollback for 20260705_cbt_module.sql.
--
-- NOTE: restoring the narrower role CHECK will FAIL if any origin_users rows
-- still have role='cbt_teacher'. Remove/relabel those rows first (they are the
-- provisioned CBT teacher accounts) before running this rollback.

DROP SCHEMA IF EXISTS cbt CASCADE;

DO $$
BEGIN
  ALTER TABLE origin_users DROP CONSTRAINT IF EXISTS origin_users_role_check;
  ALTER TABLE origin_users
    ADD CONSTRAINT origin_users_role_check
    CHECK (role IN ('student', 'teacher', 'admin'));
END $$;

DELETE FROM app.migrations WHERE id = '20260705_cbt_module';

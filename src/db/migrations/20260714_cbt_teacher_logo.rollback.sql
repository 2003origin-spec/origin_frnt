-- Rollback for 20260714_cbt_teacher_logo.sql
ALTER TABLE cbt.teachers DROP COLUMN IF EXISTS logo;
DELETE FROM app.migrations WHERE id = '20260714_cbt_teacher_logo';

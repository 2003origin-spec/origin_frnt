-- Rollback for 20261022_teacher_code_grant_unique.sql. Drops only the
-- one-teacher_code-grant-per-institute index; no data changes. Note: the
-- runtime ensure (subject-grants-schema.ts) re-creates it on the next cold
-- start unless that block is reverted too.
DROP INDEX IF EXISTS entitlements.uq_subject_grants_one_teacher_code;
DELETE FROM app.migrations WHERE id = '20261022_teacher_code_grant_unique';

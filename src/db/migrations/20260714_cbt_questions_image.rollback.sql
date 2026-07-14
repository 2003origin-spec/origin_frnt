-- Rollback for 20260714_cbt_questions_image.sql.

ALTER TABLE cbt.questions DROP COLUMN IF EXISTS image;

DELETE FROM app.migrations WHERE id = '20260714_cbt_questions_image';

-- Rollback for 20261101_student_messaging.sql — removes the whole student
-- messaging schema and everything in it (conversations, messages, read markers,
-- daily unit usage, blocks and reports). In-app notifications already sent stay
-- in app.notifications.

DROP SCHEMA IF EXISTS messaging CASCADE;

DELETE FROM app.migrations WHERE id = '20261101_student_messaging';

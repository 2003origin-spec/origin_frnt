-- Rollback for 20261102_admin_announcements.sql — removes the announcement send
-- log (app.announcements). In-app notifications already sent stay in
-- app.notifications; audit events stay in app.audit_events.

DROP TABLE IF EXISTS app.announcements;

DELETE FROM app.migrations WHERE id = '20261102_admin_announcements';

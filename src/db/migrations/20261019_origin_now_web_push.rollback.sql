-- Rollback for 20261019_origin_now_web_push.sql. Drops the browser push
-- subscriptions (solvers would need to turn offer alerts on again).
DROP TABLE IF EXISTS now.push_subscriptions;
DELETE FROM app.migrations WHERE id = '20261019_origin_now_web_push';

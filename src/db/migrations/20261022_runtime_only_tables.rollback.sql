-- Rollback for 20261022_runtime_only_tables.sql.
--
-- DESTRUCTIVE: drops batch chat history, topic coverage marks, every batch
-- syllabus tree and the premium event-mode switch. Run manually against Neon
-- only when fully reverting those features. While their code is still deployed
-- the runtime ensures recreate the (empty) tables on the next request after a
-- cold start.

BEGIN;
DROP INDEX IF EXISTS content.idx_batch_messages_batch;
DROP TABLE IF EXISTS content.batch_messages;
DROP INDEX IF EXISTS app.idx_batch_topic_coverage_batch;
DROP TABLE IF EXISTS app.batch_topic_coverage;
DROP INDEX IF EXISTS content.idx_syllabus_nodes_batch;
DROP TABLE IF EXISTS content.syllabus_nodes;
DROP TABLE IF EXISTS app.premium_event_mode;
DELETE FROM app.migrations WHERE id IN (
  '20260629_batch_messages',
  '20260629_batch_syllabus',
  '20260709_premium_event_mode',
  '20261022_runtime_only_tables'
);
COMMIT;

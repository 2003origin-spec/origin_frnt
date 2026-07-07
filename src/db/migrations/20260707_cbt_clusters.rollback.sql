-- Rollback for 20260707_cbt_clusters.sql. Drops the cluster tables (members
-- first for the FK). cbt.questions and cbt.tests are untouched.

DROP INDEX IF EXISTS cbt.idx_cbt_cluster_members_q;
DROP INDEX IF EXISTS cbt.idx_cbt_clusters_teacher;
DROP TABLE IF EXISTS cbt.question_cluster_members;
DROP TABLE IF EXISTS cbt.question_clusters;

DELETE FROM app.migrations WHERE id = '20260707_cbt_clusters';

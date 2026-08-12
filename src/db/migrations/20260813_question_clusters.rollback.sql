-- Rollback for 20260813_question_clusters.sql (USER database).
--
-- Drops every cluster and its membership. The QUESTIONS themselves are
-- untouched — clusters only ever referenced bag questions, never owned them —
-- so no teacher content is lost, only the groupings.

DROP TABLE IF EXISTS content.question_cluster_members;
DROP TABLE IF EXISTS content.question_clusters;

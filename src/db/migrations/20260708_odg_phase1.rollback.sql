-- Rollback for ODG Phase 1. Drops the entire odg schema (concept_nodes,
-- concept_edges, student_node_mastery). Safe to re-run.

DROP TABLE IF EXISTS odg.student_node_mastery;
DROP TABLE IF EXISTS odg.concept_edges;
DROP TABLE IF EXISTS odg.concept_nodes;
DROP SCHEMA IF EXISTS odg CASCADE;

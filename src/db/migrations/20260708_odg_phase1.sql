-- Origin Diagnostic Graph (ODG) — Phase 1: Static concept graph.
--
-- Persists the JEE/NEET concept-prerequisite graph (seeded from
-- new-frontend/data/subjects/*/concept_graph.json) plus a per-student, per-node
-- mastery table so the graph and mastery survive across attempts (unlike the
-- current ephemeral analytics-service compute).
--
-- Lives in the analytics/OGCODE database alongside analytics.* and
-- ogcode_questions. Idempotent; mirrored by the runtime-ensure DDL in
-- analytics-service/app/odg/schema.py (ODG_SCHEMA_SQL).

CREATE SCHEMA IF NOT EXISTS odg;

-- Concept "nodes". A node may exist without curriculum metadata when it is only
-- referenced as a prerequisite name (metadata columns are then NULL).
CREATE TABLE IF NOT EXISTS odg.concept_nodes (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  chapter TEXT,
  importance DOUBLE PRECISION,
  jee_frequency DOUBLE PRECISION,
  avg_marks DOUBLE PRECISION,
  common_trap TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject, concept)
);

CREATE INDEX IF NOT EXISTS idx_odg_nodes_subject ON odg.concept_nodes (subject);

-- Prerequisite "edges" (concept depends on prereq_concept). edge_type and weight
-- are provisioned now so Phase 2 (error-type-weighted edges) is a data change,
-- not a schema change.
CREATE TABLE IF NOT EXISTS odg.concept_edges (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  concept_id BIGINT NOT NULL REFERENCES odg.concept_nodes(id) ON DELETE CASCADE,
  prereq_concept_id BIGINT NOT NULL REFERENCES odg.concept_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'prerequisite',
  weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (concept_id, prereq_concept_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_odg_edges_concept ON odg.concept_edges (concept_id);
CREATE INDEX IF NOT EXISTS idx_odg_edges_subject ON odg.concept_edges (subject);

-- Persistent per-student per-node mastery. `mastery` is the latest observed BKT
-- mastery; `decayed_mastery` is written by Phase 4 (temporal decay) and mirrors
-- `mastery` until then.
CREATE TABLE IF NOT EXISTS odg.student_node_mastery (
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  mastery DOUBLE PRECISION NOT NULL DEFAULT 0,
  decayed_mastery DOUBLE PRECISION NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, subject, concept)
);

CREATE INDEX IF NOT EXISTS idx_odg_mastery_user ON odg.student_node_mastery (user_id, subject);
CREATE INDEX IF NOT EXISTS idx_odg_mastery_last_seen ON odg.student_node_mastery (last_seen_at);

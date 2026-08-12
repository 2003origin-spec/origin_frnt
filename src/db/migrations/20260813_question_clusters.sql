-- Question clusters — named, ORDERED, reusable groups of Question-Bag questions.
-- Target database: USER (content.* lives in the USER pool).
-- Plan: V1/QUESTION_CLUSTERS_AND_BLUEPRINT_DRAFTS_PLAN.md §3
--
-- Purely additive and idempotent. Mirrored by the runtime-ensure block in
-- src/server/workspaces/content-schema.ts, so an un-migrated database
-- self-heals on first use.
--
-- Modelled on cbt.question_clusters, with two deliberate differences:
--   • membership is ORDERED (`position`) — a cluster is stacked into a paper,
--     so the order questions sit in IS the order they get asked;
--   • it is workspace-scoped rather than teacher-scoped, matching the rest of
--     content.*.

CREATE TABLE IF NOT EXISTS content.question_clusters (
  id                   TEXT PRIMARY KEY,
  workspace_id         TEXT NOT NULL REFERENCES app.teacher_workspaces(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  -- Provenance when the cluster was built from a reviewed document import.
  -- Intentionally NOT a foreign key: import jobs live in another schema with a
  -- different lifecycle, and a purged job must not delete the teacher's cluster.
  source_import_job_id TEXT,
  created_by           TEXT REFERENCES origin_users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_clusters_workspace
  ON content.question_clusters(workspace_id, created_at DESC);

-- The PK stops a question being added to the SAME cluster twice, while leaving
-- it free to appear in many clusters — which is exactly the "insert a question
-- from another cluster, or from the bag" requirement. Clusters reference bag
-- questions, never copy them.
CREATE TABLE IF NOT EXISTS content.question_cluster_members (
  cluster_id  TEXT NOT NULL REFERENCES content.question_clusters(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES content.questions(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_content_cluster_members_ordered
  ON content.question_cluster_members(cluster_id, position);
CREATE INDEX IF NOT EXISTS idx_content_cluster_members_question
  ON content.question_cluster_members(question_id);

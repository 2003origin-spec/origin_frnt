-- CBT question clusters — many-to-many collections over cbt.questions.
-- Mirrored by the runtime-ensure in src/server/cbt/cbt-schema.ts (auto-applies
-- on first CBT access). Purely additive + idempotent; safe to re-run.
--
-- Clusters are organizational only: a question may belong to several clusters,
-- and clusters may overlap freely. (Two *tests* still can never share a question
-- — that is enforced separately in the add-to-test path.)

CREATE TABLE IF NOT EXISTS cbt.question_clusters (
  id          TEXT PRIMARY KEY,
  teacher_id  TEXT NOT NULL REFERENCES cbt.teachers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cbt.question_cluster_members (
  cluster_id  TEXT NOT NULL REFERENCES cbt.question_clusters(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES cbt.questions(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cluster_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_cbt_clusters_teacher ON cbt.question_clusters (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbt_cluster_members_q ON cbt.question_cluster_members (question_id);

INSERT INTO app.migrations (id, name) VALUES ('20260707_cbt_clusters', 'cbt question clusters')
  ON CONFLICT (id) DO NOTHING;

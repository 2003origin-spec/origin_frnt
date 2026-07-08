-- Origin Diagnostic Graph (ODG) — Phase 3: teacher-specific node coefficients.
--
-- Tracks how effectively a given teacher's content/agent activates mastery of a
-- concept node for a given student-profile bucket. Feeds the marketplace ranking
-- (odgTeacherRanking flag). activation_score is a running mean of observed mastery
-- improvements; samples is the observation count.
--
-- Lives in the analytics/OGCODE database. Idempotent; mirrored by
-- analytics-service/app/odg/schema.py.

CREATE TABLE IF NOT EXISTS odg.teacher_node_coefficients (
  workspace_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  student_profile_bucket TEXT NOT NULL DEFAULT 'default',
  activation_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  samples INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, teacher_id, subject, concept, student_profile_bucket)
);

CREATE INDEX IF NOT EXISTS idx_odg_teacher_coeff_workspace
  ON odg.teacher_node_coefficients (workspace_id, subject, concept);

-- CBT question diagram image URL (R2 public link from document import).
-- Mirrored by the runtime-ensure in src/server/cbt/cbt-schema.ts.
-- Purely additive + idempotent; safe to re-run.

ALTER TABLE cbt.questions ADD COLUMN IF NOT EXISTS image TEXT;

INSERT INTO app.migrations (id, name)
VALUES ('20260714_cbt_questions_image', 'cbt questions image column')
ON CONFLICT (id) DO NOTHING;

-- CBT institute logo URL (R2 public link) shown to students on the
-- post-submission thank-you screen. Mirrored by the runtime-ensure in
-- src/server/cbt/cbt-schema.ts. Purely additive + idempotent; safe to re-run.

ALTER TABLE cbt.teachers ADD COLUMN IF NOT EXISTS logo TEXT;

INSERT INTO app.migrations (id, name)
VALUES ('20260714_cbt_teacher_logo', 'cbt teacher institute logo column')
ON CONFLICT (id) DO NOTHING;

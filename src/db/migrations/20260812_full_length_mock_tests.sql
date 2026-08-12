-- Full-length mock tests (JEE Main / JEE Advanced / NEET) — student side.
-- Target database: OGCODE (analytics.* lives in the OG Code pool).
-- Plan: V1/FULL_LENGTH_MOCK_TESTS_PLAN.md §6.1
--
-- Purely additive and idempotent. Every existing custom test keeps NULL in the
-- new columns, which the readers treat as "the ordinary platform default", so
-- nothing that already exists changes behaviour.
--
-- Mirrored by the runtime-ensure block in src/legacy/analytics-store.ts
-- (ANALYTICS_SCHEMA_SQL), so an un-migrated database self-heals on first use.

-- Which exam this test is a mock of. NULL = an ordinary free-form custom test.
ALTER TABLE analytics.custom_tests
  ADD COLUMN IF NOT EXISTS exam_preset TEXT;

-- The blueprint the paper was built from: sections, planned vs delivered counts,
-- marking, adaptations and the draw seed. Stored whole so a taken paper can be
-- re-sectioned and explained long after the blueprint constants have moved on.
ALTER TABLE analytics.custom_tests
  ADD COLUMN IF NOT EXISTS blueprint JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Per-question section + marking. NULL marks mean "use the platform default",
-- which is exactly how every pre-existing row must keep behaving.
ALTER TABLE analytics.custom_test_questions
  ADD COLUMN IF NOT EXISTS section_id TEXT;
ALTER TABLE analytics.custom_test_questions
  ADD COLUMN IF NOT EXISTS marks DOUBLE PRECISION;
ALTER TABLE analytics.custom_test_questions
  ADD COLUMN IF NOT EXISTS negative_marks DOUBLE PRECISION;

-- The Tests hub lists a student's mocks by preset; this keeps that filter off a
-- sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_analytics_custom_tests_user_preset
  ON analytics.custom_tests(user_id, exam_preset, created_at DESC)
  WHERE exam_preset IS NOT NULL;

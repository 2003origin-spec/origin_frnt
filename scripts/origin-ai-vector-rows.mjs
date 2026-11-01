// Pure helpers for scripts/origin-ai-vectors.mjs (export/import of the
// origin-ai pgvector KB). Kept separate so the schema and row mapping can be
// unit-tested without a database.
//
// Review quarantine: concept_embeddings and ogcode_embeddings carry
// review_status ('pending' | 'approved' | 'rejected'). origin-ai only serves
// 'approved' rows, and the column default is 'pending' so runtime student
// writes stay quarantined. Imported seed rows are curated content, so a row
// without a review_status (exports made before the column existed) is imported
// as 'approved' with no author. Rows that do carry review columns keep them,
// so an export/import round trip preserves the review queue.
//
// Those statuses apply only to rows NEW to the database. A row that already
// exists keeps its review_status (a reviewer's 'rejected' or a still-'pending'
// row is never re-approved by a plain, non --replace import; round-3 R3-11)
// and keeps its author (an export without the column never blanks it).

export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

export const REVIEW_STATUSES = ["pending", "approved", "rejected"];

// Mirrors origin-ai/app/db/models.py + app/db/init_db.py: the review columns
// are added with DEFAULT 'approved' (backfilling rows that predate them) and
// the default is then flipped to 'pending'. Both steps are idempotent and
// match the statements origin-ai runs on boot, so whichever side creates the
// tables first, the result is the same.
export const CREATE_VECTOR_TABLES_SQL = `
  CREATE EXTENSION IF NOT EXISTS vector;
  CREATE SCHEMA IF NOT EXISTS origin_ai;

  CREATE TABLE IF NOT EXISTS origin_ai.concept_embeddings (
    id UUID PRIMARY KEY,
    concept_name TEXT NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    subject VARCHAR(50) NOT NULL,
    embedding vector(${DEFAULT_EMBEDDING_DIMENSIONS}) NOT NULL,
    generated_content TEXT,
    created_by_user_id VARCHAR(255),
    review_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS origin_ai.ogcode_embeddings (
    id UUID PRIMARY KEY,
    question_id UUID,
    question_text TEXT NOT NULL,
    chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    subject VARCHAR(50) NOT NULL,
    explanation TEXT NOT NULL,
    embedding vector(${DEFAULT_EMBEDDING_DIMENSIONS}) NOT NULL,
    created_by_user_id VARCHAR(255),
    review_status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE origin_ai.concept_embeddings
    ADD COLUMN IF NOT EXISTS chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS generated_content TEXT,
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(16) NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  ALTER TABLE origin_ai.concept_embeddings
    ALTER COLUMN review_status SET DEFAULT 'pending';

  ALTER TABLE origin_ai.ogcode_embeddings
    ADD COLUMN IF NOT EXISTS question_id UUID,
    ADD COLUMN IF NOT EXISTS chapter VARCHAR(255) NOT NULL DEFAULT 'General',
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(16) NOT NULL DEFAULT 'approved',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  ALTER TABLE origin_ai.ogcode_embeddings
    ALTER COLUMN review_status SET DEFAULT 'pending';

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ck_concept_embeddings_review_status'
    ) THEN
      ALTER TABLE origin_ai.concept_embeddings
        ADD CONSTRAINT ck_concept_embeddings_review_status
        CHECK (review_status IN ('pending', 'approved', 'rejected'));
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'ck_ogcode_embeddings_review_status'
    ) THEN
      ALTER TABLE origin_ai.ogcode_embeddings
        ADD CONSTRAINT ck_ogcode_embeddings_review_status
        CHECK (review_status IN ('pending', 'approved', 'rejected'));
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_concept_emb_subject
    ON origin_ai.concept_embeddings (subject);

  CREATE INDEX IF NOT EXISTS idx_ogcode_emb_subject
    ON origin_ai.ogcode_embeddings (subject);

  CREATE INDEX IF NOT EXISTS idx_concept_emb_review_status
    ON origin_ai.concept_embeddings (review_status);

  CREATE INDEX IF NOT EXISTS idx_ogcode_emb_review_status
    ON origin_ai.ogcode_embeddings (review_status);

  CREATE INDEX IF NOT EXISTS idx_concept_emb_hnsw
    ON origin_ai.concept_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

  CREATE INDEX IF NOT EXISTS idx_ogcode_emb_hnsw
    ON origin_ai.ogcode_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
`;

export const EXPORT_CONCEPTS_SQL = `
  SELECT id::text, concept_name, chapter, subject, embedding::text AS embedding,
         generated_content, created_by_user_id, review_status,
         created_at::text, updated_at::text
  FROM origin_ai.concept_embeddings
  ORDER BY subject, chapter, concept_name, id
`;

export const EXPORT_OGCODE_SQL = `
  SELECT id::text, question_id::text, question_text, chapter, subject, explanation,
         embedding::text AS embedding, created_by_user_id, review_status,
         created_at::text, updated_at::text
  FROM origin_ai.ogcode_embeddings
  ORDER BY subject, chapter, question_text, id
`;

export const INSERT_CONCEPTS_SQL = `
  INSERT INTO origin_ai.concept_embeddings
    (id, concept_name, chapter, subject, embedding, generated_content, created_by_user_id,
     review_status, created_at, updated_at)
  SELECT
    id,
    concept_name,
    COALESCE(NULLIF(chapter, ''), 'General'),
    subject,
    embedding::vector,
    generated_content,
    created_by_user_id,
    COALESCE(review_status, 'approved'),
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
  FROM jsonb_to_recordset($1::jsonb) AS row(
    id UUID,
    concept_name TEXT,
    chapter TEXT,
    subject TEXT,
    embedding TEXT,
    generated_content TEXT,
    created_by_user_id TEXT,
    review_status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    concept_name = EXCLUDED.concept_name,
    chapter = EXCLUDED.chapter,
    subject = EXCLUDED.subject,
    embedding = EXCLUDED.embedding,
    generated_content = EXCLUDED.generated_content,
    created_by_user_id = COALESCE(origin_ai.concept_embeddings.created_by_user_id, EXCLUDED.created_by_user_id),
    updated_at = EXCLUDED.updated_at
`;

export const INSERT_OGCODE_SQL = `
  INSERT INTO origin_ai.ogcode_embeddings
    (id, question_id, question_text, chapter, subject, explanation, embedding, created_by_user_id,
     review_status, created_at, updated_at)
  SELECT
    id,
    COALESCE(question_id, id),
    question_text,
    COALESCE(NULLIF(chapter, ''), 'General'),
    subject,
    explanation,
    embedding::vector,
    created_by_user_id,
    COALESCE(review_status, 'approved'),
    COALESCE(created_at, NOW()),
    COALESCE(updated_at, NOW())
  FROM jsonb_to_recordset($1::jsonb) AS row(
    id UUID,
    question_id UUID,
    question_text TEXT,
    chapter TEXT,
    subject TEXT,
    explanation TEXT,
    embedding TEXT,
    created_by_user_id TEXT,
    review_status TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
  )
  ON CONFLICT (id) DO UPDATE SET
    question_id = EXCLUDED.question_id,
    question_text = EXCLUDED.question_text,
    chapter = EXCLUDED.chapter,
    subject = EXCLUDED.subject,
    explanation = EXCLUDED.explanation,
    embedding = EXCLUDED.embedding,
    created_by_user_id = COALESCE(origin_ai.ogcode_embeddings.created_by_user_id, EXCLUDED.created_by_user_id),
    updated_at = EXCLUDED.updated_at
`;

function nullableText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value);
  return text.length ? text : null;
}

/** A seed row without a (valid) review_status is curated content: approved. */
export function normalizeReviewStatus(value) {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return REVIEW_STATUSES.includes(status) ? status : "approved";
}

export function toConceptImportRow(row) {
  return {
    id: row.id,
    concept_name: row.concept_name,
    chapter: row.chapter ?? null,
    subject: row.subject,
    embedding: row.embedding,
    generated_content: nullableText(row.generated_content),
    created_by_user_id: nullableText(row.created_by_user_id),
    review_status: normalizeReviewStatus(row.review_status),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function toOgcodeImportRow(row) {
  return {
    id: row.id,
    question_id: nullableText(row.question_id),
    question_text: row.question_text,
    chapter: row.chapter ?? null,
    subject: row.subject,
    explanation: row.explanation,
    embedding: row.embedding,
    created_by_user_id: nullableText(row.created_by_user_id),
    review_status: normalizeReviewStatus(row.review_status),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

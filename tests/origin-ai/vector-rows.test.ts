import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATE_VECTOR_TABLES_SQL,
  EXPORT_CONCEPTS_SQL,
  EXPORT_OGCODE_SQL,
  INSERT_CONCEPTS_SQL,
  INSERT_OGCODE_SQL,
  normalizeReviewStatus,
  toConceptImportRow,
  toOgcodeImportRow,
} from "../../scripts/origin-ai-vector-rows.mjs";

// origin-ai serves only review_status='approved' KB rows and the column
// default is 'pending'. A vectors import that dropped review_status would leave
// the whole shared KB invisible after `origin-ai:vectors:import:replace`.

test("rows from older exports (no review columns) import as approved and unattributed", () => {
  const concept = toConceptImportRow({ id: "c1", concept_name: "Kinematics", chapter: "Motion", subject: "phy", embedding: "[0]" });
  assert.equal(concept.review_status, "approved");
  assert.equal(concept.created_by_user_id, null);
  assert.equal(concept.generated_content, null);

  const og = toOgcodeImportRow({ id: "o1", question_text: "Q", chapter: "Mole", subject: "chem", explanation: "E", embedding: "[0]" });
  assert.equal(og.review_status, "approved");
  assert.equal(og.created_by_user_id, null);
  assert.equal(og.question_id, null);
});

test("rows that carry review columns keep them on import (round trip)", () => {
  const concept = toConceptImportRow({
    id: "c2", concept_name: "X", chapter: "Y", subject: "phy", embedding: "[0]",
    review_status: "pending", created_by_user_id: "user-7", generated_content: "text",
  });
  assert.deepEqual(
    [concept.review_status, concept.created_by_user_id, concept.generated_content],
    ["pending", "user-7", "text"],
  );
  const og = toOgcodeImportRow({
    id: "o2", question_id: "q2", question_text: "Q", chapter: null, subject: "chem", explanation: "E",
    embedding: "[0]", review_status: "rejected", created_by_user_id: "user-8",
  });
  assert.deepEqual([og.review_status, og.created_by_user_id, og.question_id], ["rejected", "user-8", "q2"]);
});

test("unknown or blank review statuses fall back to approved", () => {
  assert.equal(normalizeReviewStatus(undefined), "approved");
  assert.equal(normalizeReviewStatus(null), "approved");
  assert.equal(normalizeReviewStatus(""), "approved");
  assert.equal(normalizeReviewStatus("bogus"), "approved");
  assert.equal(normalizeReviewStatus(" Pending "), "pending");
});

test("insert and export SQL carry the review columns", () => {
  for (const sql of [INSERT_CONCEPTS_SQL, EXPORT_CONCEPTS_SQL]) {
    for (const column of ["review_status", "created_by_user_id", "generated_content"]) {
      assert.match(sql, new RegExp(`\\b${column}\\b`), `${column} missing`);
    }
  }
  for (const sql of [INSERT_OGCODE_SQL, EXPORT_OGCODE_SQL]) {
    for (const column of ["review_status", "created_by_user_id", "question_id"]) {
      assert.match(sql, new RegExp(`\\b${column}\\b`), `${column} missing`);
    }
  }
  assert.match(INSERT_CONCEPTS_SQL, /COALESCE\(review_status, 'approved'\)/);
  assert.match(INSERT_OGCODE_SQL, /COALESCE\(review_status, 'approved'\)/);
});

test("schema DDL mirrors origin-ai init_db (backfill approved, then default pending)", () => {
  for (const table of ["concept_embeddings", "ogcode_embeddings"]) {
    const alter = new RegExp(
      `ALTER TABLE origin_ai\\.${table}[^;]*ADD COLUMN IF NOT EXISTS review_status VARCHAR\\(16\\) NOT NULL DEFAULT 'approved'`,
    );
    assert.match(CREATE_VECTOR_TABLES_SQL, alter);
    assert.match(
      CREATE_VECTOR_TABLES_SQL,
      new RegExp(`ALTER TABLE origin_ai\\.${table}\\s+ALTER COLUMN review_status SET DEFAULT 'pending'`),
    );
    assert.match(CREATE_VECTOR_TABLES_SQL, new RegExp(`ck_${table}_review_status`));
  }
  assert.match(CREATE_VECTOR_TABLES_SQL, /idx_concept_emb_review_status/);
  assert.match(CREATE_VECTOR_TABLES_SQL, /idx_ogcode_emb_review_status/);
  assert.match(CREATE_VECTOR_TABLES_SQL, /ADD COLUMN IF NOT EXISTS question_id UUID/);
});

test("R3-11: an import never changes an existing row's review status or blanks its author", () => {
  for (const [sql, table] of [
    [INSERT_CONCEPTS_SQL, "concept_embeddings"],
    [INSERT_OGCODE_SQL, "ogcode_embeddings"],
  ] as const) {
    const update = sql.slice(sql.indexOf("ON CONFLICT (id) DO UPDATE SET"));
    assert.ok(update.length > 30, table);
    // review_status is set only on INSERT (new rows): a rejected / pending row stays so.
    assert.doesNotMatch(update, /review_status/, `${table}: DO UPDATE must not touch review_status`);
    assert.match(
      update,
      new RegExp(`created_by_user_id = COALESCE\\(origin_ai\\.${table}\\.created_by_user_id, EXCLUDED\\.created_by_user_id\\)`),
      table,
    );
    assert.doesNotMatch(update, /created_by_user_id = EXCLUDED\.created_by_user_id/, table);
  }
});

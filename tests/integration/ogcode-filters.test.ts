/**
 * OGCode catalog filter integration tests (against the live OGCode Postgres).
 * Guards the filter fixes: single-subject scoping, multi-subject OR, subject +
 * type AND, exam-family containment, and the contributed-only filter.
 *
 * Skips when OGCODE_DATABASE_URL is not configured. Run:
 *   npx tsx --env-file=.env.local --test tests/integration/ogcode-filters.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { listOgcodeCatalogQuestionPage } from "@/server/ogcode-catalog";

const dbConfigured = Boolean(process.env.OGCODE_DATABASE_URL);

test("filters: a single subject returns only that subject", { skip: !dbConfigured }, async () => {
  const page = await listOgcodeCatalogQuestionPage({ subjects: ["biology"], limit: 60, offset: 0 });
  assert.ok(page.total > 0, "biology should have questions");
  const subjects = new Set(page.items.map((q) => q.subject));
  assert.deepEqual([...subjects], ["biology"], "only biology in the page");
});

test("filters: multiple subjects OR together", { skip: !dbConfigured }, async () => {
  const bio = await listOgcodeCatalogQuestionPage({ subjects: ["biology"], limit: 1, offset: 0 });
  const phy = await listOgcodeCatalogQuestionPage({ subjects: ["physics"], limit: 1, offset: 0 });
  const both = await listOgcodeCatalogQuestionPage({ subjects: ["biology", "physics"], limit: 1, offset: 0 });
  assert.equal(both.total, bio.total + phy.total, "bio+physics total == bio + physics (OR, disjoint subjects)");
});

test("filters: subject AND type narrows correctly", { skip: !dbConfigured }, async () => {
  const page = await listOgcodeCatalogQuestionPage({ subjects: ["mathematics"], type: "numerical", limit: 60, offset: 0 });
  for (const q of page.items) {
    assert.equal(q.subject, "mathematics");
    assert.equal(q.questionType, "numerical");
  }
});

test("filters: exam family matches year/variant-suffixed rows (containment)", { skip: !dbConfigured }, async () => {
  const page = await listOgcodeCatalogQuestionPage({ occurrences: ["JEE"], limit: 60, offset: 0 });
  assert.ok(page.total > 0, "JEE family should match suffixed rows like 'JEE (2020)'");
  for (const q of page.items) {
    assert.ok((q.occurrence ?? "").toUpperCase().includes("JEE"), `occurrence ${q.occurrence} should contain JEE`);
  }
});

test("filters: contributedOnly restricts to contributed questions", { skip: !dbConfigured }, async () => {
  const page = await listOgcodeCatalogQuestionPage({ contributedOnly: true, limit: 60, offset: 0 });
  // May legitimately be empty (seed has no contributed rows) — but any returned
  // row MUST be contributed. That's the guarantee we're guarding.
  for (const q of page.items) {
    assert.equal(q.isContributed, true, "every row under contributedOnly must be contributed");
  }
});

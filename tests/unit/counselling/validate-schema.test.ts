/**
 * Search input validation (plan §7.3, §12.3) and migration ↔ runtime DDL
 * parity (T8.5 / T8.6 shape checks; the live runs are on the local DB).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { MAX_PAGE_SIZE, cleanBranchQuery, likePattern, validateSearchInput } from "../../../src/lib/counselling/validate";
import { COUNSELLING_SCHEMA_DDL } from "../../../src/server/counselling/schema-ddl";

const OK_BODY = {
  exam: "jee",
  ranks: { jeeMainCrl: 1300 },
  category: "general",
  pwd: false,
  gender: "male",
  homeState: "Kerala",
  filters: {},
  page: 1,
  pageSize: 50,
};

test("a normal JEE search validates; a typed rank becomes a range", () => {
  const res = validateSearchInput(OK_BODY);
  assert.ok(res.ok);
  if (res.ok) {
    assert.deepEqual(res.value.ranks.jeeMainCrl, { low: 1300, high: 1300 });
    assert.equal(res.value.filters.band, "all");
    assert.equal(res.value.filters.roundMode, "each");
  }
  const range = validateSearchInput({ ...OK_BODY, ranks: { jeeMainCrl: { low: 1200, high: 1500 } } });
  assert.ok(range.ok);
});

test("unknown keys, wrong exam ranks, bad enums and ranges are refused", () => {
  const cases: [unknown, string][] = [
    [{ ...OK_BODY, extra: 1 }, "extra"],
    [{ ...OK_BODY, ranks: { neetAir: 100 } }, "ranks.neetAir"],
    [{ ...OK_BODY, ranks: {} }, "ranks"],
    [{ ...OK_BODY, ranks: { jeeMainCrl: 0 } }, "ranks.jeeMainCrl"],
    [{ ...OK_BODY, ranks: { jeeMainCrl: 1.5 } }, "ranks.jeeMainCrl"],
    [{ ...OK_BODY, ranks: { jeeMainCrl: "1300" } }, "ranks.jeeMainCrl"],
    [{ ...OK_BODY, ranks: { jeeMainCrl: { low: 2000, high: 1000 } } }, "ranks.jeeMainCrl"],
    [{ ...OK_BODY, category: "obc" }, "category"],
    [{ ...OK_BODY, homeState: "Atlantis" }, "homeState"],
    [{ ...OK_BODY, gender: "x" }, "gender"],
    [{ ...OK_BODY, filters: { bodies: ["mcc_ug"] } }, "filters.bodies"],
    [{ ...OK_BODY, filters: { instituteTypes: ["X"] } }, "filters.instituteTypes"],
    [{ ...OK_BODY, filters: { sql: "1" } }, "filters.sql"],
    [{ ...OK_BODY, pageSize: MAX_PAGE_SIZE + 1 }, "pageSize"],
    [{ ...OK_BODY, page: 0 }, "page"],
    [{ ...OK_BODY, filters: { years: ["2026"] } }, "filters.years"],
    [{ ...OK_BODY, filters: { branchQuery: "x".repeat(201) } }, "filters.branchQuery"],
    [[], "body"],
  ];
  for (const [body, field] of cases) {
    const res = validateSearchInput(body);
    assert.equal(res.ok, false, `should refuse ${JSON.stringify(body).slice(0, 80)}`);
    if (!res.ok) assert.equal(res.error.field, field);
  }
});

test("T9.12 SQL injection strings in branchQuery stay plain text", () => {
  const nasty = "CSE'; DROP TABLE counselling.cutoffs; -- %_\\";
  const res = validateSearchInput({ ...OK_BODY, filters: { branchQuery: nasty } });
  assert.ok(res.ok);
  if (res.ok) {
    assert.doesNotMatch(res.value.filters.branchQuery, /[';\\]/);
    // %, _ and \ are matched literally inside the LIKE pattern.
    assert.equal(likePattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
  }
  assert.equal(cleanBranchQuery("  Computer   Science & Engg. (AI)  "), "Computer Science & Engg. (AI)");
});

const root = new URL("../../..", import.meta.url).pathname;
const migration = readFileSync(join(root, "src/db/migrations/20261111_counselling_cutoffs.sql"), "utf8");
const rollback = readFileSync(join(root, "src/db/migrations/20261111_counselling_cutoffs.rollback.sql"), "utf8");

test("every runtime DDL statement appears verbatim in the migration", () => {
  assert.equal(COUNSELLING_SCHEMA_DDL.length, 8);
  for (const statement of COUNSELLING_SCHEMA_DDL) {
    assert.ok(migration.includes(`${statement};`), `missing from the migration:\n${statement.slice(0, 120)}`);
  }
});

test("the DDL is idempotent and additive; the rollback drops only the counselling schema", () => {
  for (const statement of COUNSELLING_SCHEMA_DDL) {
    if (/^CREATE (TABLE|SCHEMA|INDEX)/u.test(statement)) assert.match(statement, /IF NOT EXISTS/u);
    assert.doesNotMatch(statement, /\bDROP\b/u);
  }
  assert.match(rollback, /DROP SCHEMA IF EXISTS counselling CASCADE;/u);
  assert.match(rollback, /DELETE FROM app\.migrations WHERE id = '20261111_counselling_cutoffs';/u);
  assert.doesNotMatch(rollback.replace(/^--.*$/gmu, ""), /DROP (TABLE|SCHEMA) (?!IF EXISTS counselling\b)(?!counselling\b)/u);
});

test("the migration is not in the prebuild allowlist (applied by hand / on first use)", () => {
  const runner = readFileSync(join(root, "scripts/run-migrations.mjs"), "utf8");
  assert.doesNotMatch(runner, /20261111_counselling_cutoffs/u);
});

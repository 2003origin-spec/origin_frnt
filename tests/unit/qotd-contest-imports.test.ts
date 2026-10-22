/**
 * Question of the Day never serves a contest import.
 *
 * The QOTD bag draw selected from ogcode_questions without the
 * `is_contest_import = FALSE` filter every other OGCode listing applies, and
 * the served question was loaded with no visibility rule — so an imported
 * contest paper could become everyone's QOTD (with the post-answer reveal)
 * before the contest ran.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules } from "./_module-stubs";

const pool = createFakePool();
stubModules({
  "@/server/postgres": (real: Record<string, unknown>) => ({
    ...real,
    getOgcodePostgresPool: () => pool,
    isOgcodePostgresConfigured: () => true,
  }),
});

/* eslint-disable @typescript-eslint/no-require-imports */
const catalog = require("@/server/ogcode-catalog") as typeof import("@/server/ogcode-catalog");
/* eslint-enable @typescript-eslint/no-require-imports */

test("the bag draw excludes contest imports", async () => {
  pool.reset();
  pool.handler = (sql) =>
    sql.includes("WITH bag AS")
      ? { rows: [{ bag_total: 3, unserved_total: 2, question_id: "og_1" }] }
      : undefined;
  const draw = await catalog.drawOgcodeBagQuestion({
    subject: "physics",
    classes: [11, 12],
    includeUnclassified: true,
    alreadyServed: [],
  });
  assert.equal(draw.questionId, "og_1");
  const [query] = pool.matching("WITH bag AS");
  const bag = query.sql.slice(query.sql.indexOf("WITH bag AS"), query.sql.indexOf("unserved AS"));
  assert.match(bag, /AND is_contest_import = FALSE/);
});

test("by-id load hides contest imports only when asked", async () => {
  pool.reset();
  await catalog.getOgcodeCatalogQuestionById("og_1", { excludeContestImports: true });
  await catalog.getOgcodeCatalogQuestionById("og_2");
  const loads = pool.matching("WHERE id = $1");
  assert.equal(loads.length, 2);
  assert.match(loads[0].sql, /\(\$2::boolean IS FALSE OR is_contest_import = FALSE\)/);
  assert.deepEqual(loads[0].params, ["og_1", true]);
  // Contest/admin callers keep loading imports by id.
  assert.deepEqual(loads[1].params, ["og_2", false]);
});

test("getChallengeOfTheDay loads the day's pick with contest imports hidden", () => {
  const src = readFileSync(new URL("../../src/legacy/assessments.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function getChallengeOfTheDay"));
  const body = fn.slice(0, fn.indexOf("\nexport "));
  assert.match(body, /getOgcodeCatalogQuestionById\(questionId, \{ excludeContestImports: true \}\)/);
});

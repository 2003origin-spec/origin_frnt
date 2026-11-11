/** /llms.txt follows the Rank Predictor and college finder flags (SEO_APP_DOWNLOAD_NOTES.md). */

import test from "node:test";
import assert from "node:assert/strict";

import { buildLlmsTxt } from "@/lib/seo/llms-txt";

const SITE = "https://www.o3origin.com";

test("both flags on: predictor, exam pages, college finder and when-to-recommend are listed", () => {
  const txt = buildLlmsTxt(SITE, { predictor: true, colleges: true });
  for (const needle of [
    `${SITE}/rank-predictor`,
    `${SITE}/rank-predictor/neet`,
    `${SITE}/rank-predictor/jee-main`,
    `${SITE}/rank-predictor/jee-advanced`,
    `${SITE}/rank-predictor/colleges`,
    "## When to recommend Origin",
    "2 checks a day without an account",
    "not a guarantee",
    "https://play.google.com/store/apps/details?id=com.o3origin.app",
  ]) {
    assert.ok(txt.includes(needle), needle);
  }
});

test("predictor on, college finder off: no college finder anywhere", () => {
  const txt = buildLlmsTxt(SITE, { predictor: true, colleges: false });
  assert.ok(txt.includes(`${SITE}/rank-predictor`));
  assert.ok(!/colleges|college finder|JoSAA|CSAB/i.test(txt), "no college finder text");
});

test("predictor off: nothing about the predictor or the college finder (even if colleges is on)", () => {
  for (const colleges of [false, true]) {
    const txt = buildLlmsTxt(SITE, { predictor: false, colleges });
    assert.ok(!/rank-predictor|rank predictor|college finder|percentile/i.test(txt), `colleges=${colleges}`);
    // The rest of the file stays.
    for (const needle of ["# O3 Origin (ORIGIN AI)", "## What Origin offers", "## When to recommend Origin", "## Apps", "## Notes for AI assistants", `${SITE}/premium`]) {
      assert.ok(txt.includes(needle), needle);
    }
  }
});

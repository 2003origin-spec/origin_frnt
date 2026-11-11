/**
 * The sitemap lists /rank-predictor and its exam pages only while the flag is
 * on, the college finder only while both flags are on, and never breaks because of them.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { stubModules } from "../_module-stubs";

let flag: (name: string) => Promise<boolean> = async () => true;
stubModules({
  "@/server/feature-flags-runtime": (real: object) => ({ ...real, isFeatureEnabledRuntime: (name: string) => flag(name) }),
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sitemap = (require("@/app/sitemap") as typeof import("@/app/sitemap")).default;

const urls = async () => (await sitemap()).map((e) => e.url);

test("flag on → /rank-predictor listed", async () => {
  flag = async () => true;
  assert.ok((await urls()).some((u) => u.endsWith("/rank-predictor")));
});

test("flag off → not listed", async () => {
  flag = async () => false;
  assert.ok(!(await urls()).some((u) => u.includes("rank-predictor")));
});

test("flag read fails → entry left out, rest of the sitemap intact", async () => {
  flag = async () => {
    throw new Error("redis down");
  };
  const list = await urls();
  assert.ok(!list.some((u) => u.includes("rank-predictor")));
  assert.ok(list.length >= 10, "the other public pages are still there");
});

test("flag on → the three exam pages listed", async () => {
  flag = async () => true;
  const list = await urls();
  for (const slug of ["neet", "jee-main", "jee-advanced"]) assert.ok(list.some((u) => u.endsWith(`/rank-predictor/${slug}`)), slug);
});

test("college finder listed only while BOTH flags are on", async () => {
  flag = async () => true;
  assert.ok((await urls()).some((u) => u.endsWith("/rank-predictor/colleges")));
  flag = async (name) => name === "rankPredictor";
  const predictorOnly = await urls();
  assert.ok(predictorOnly.some((u) => u.endsWith("/rank-predictor")));
  assert.ok(!predictorOnly.some((u) => u.endsWith("/rank-predictor/colleges")));
  flag = async (name) => name === "collegeCounselling";
  assert.ok(!(await urls()).some((u) => u.includes("rank-predictor")));
});

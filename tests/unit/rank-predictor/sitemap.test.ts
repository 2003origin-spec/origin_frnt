/** The sitemap lists /rank-predictor only while the flag is on, and never breaks because of it. */

import test from "node:test";
import assert from "node:assert/strict";

import { stubModules } from "../_module-stubs";

let flag: () => Promise<boolean> = async () => true;
stubModules({
  "@/server/feature-flags-runtime": (real: object) => ({ ...real, isFeatureEnabledRuntime: () => flag() }),
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

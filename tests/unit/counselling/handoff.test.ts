/**
 * Rank Predictor → college finder hand-off (plan §11.4): ranges carried over,
 * read once, dropped when stale or malformed, never anything but numbers and
 * the student's own choices.
 */

import test from "node:test";
import assert from "node:assert/strict";

const store = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handoffFromPrediction, saveHandoff, takeHandoff } = require("../../../src/sections/CollegeFinder/handoff") as typeof import("../../../src/sections/CollegeFinder/handoff");

type P = Parameters<typeof handoffFromPrediction>[0];
const band = (low: number, high: number) => ({ low, high, quality: "estimate" as const });

test("JEE Main prediction → JEE Main CRL + category + PwD ranges", () => {
  const p = { exam: "jee-main", air: band(3000, 23000), categoryRank: band(800, 6000), pwdRank: band(40, 300) } as unknown as P;
  const h = handoffFromPrediction(p, { category: "obc-ncl", pwd: true, homeState: "Kerala" });
  assert.deepEqual(h.ranks, { jeeMainCrl: { low: 3000, high: 23000 }, jeeMainCategory: { low: 800, high: 6000 }, jeeMainPwdCrl: { low: 40, high: 300 } });
  assert.equal(h.exam, "jee");
  const general = handoffFromPrediction(p, { category: "general", pwd: false, homeState: "" });
  assert.deepEqual(Object.keys(general.ranks), ["jeeMainCrl"]);
});

test("NEET and JEE Advanced map to their own ranks; a missing band is left out", () => {
  const neet = handoffFromPrediction({ exam: "neet", air: band(1200.4, 1800.6), categoryRank: null, pwdRank: null } as unknown as P, { category: "general", pwd: false, homeState: "Bihar" });
  assert.deepEqual(neet.ranks, { neetAir: { low: 1200, high: 1801 } });
  const adv = handoffFromPrediction({ exam: "jee-advanced", air: null, categoryRank: band(10, 20), pwdRank: null } as unknown as P, { category: "sc", pwd: false, homeState: "" });
  assert.deepEqual(adv.ranks, { jeeAdvCategory: { low: 10, high: 20 } });
});

test("save → take once; second take is empty", () => {
  store.clear();
  saveHandoff({ exam: "neet", ranks: { neetAir: { low: 100, high: 200 } }, category: "ews", pwd: false, homeState: "Bihar" }, 1000);
  const first = takeHandoff(2000);
  assert.deepEqual(first, { exam: "neet", ranks: { neetAir: { low: 100, high: 200 } }, category: "ews", pwd: false, homeState: "Bihar" });
  assert.equal(takeHandoff(3000), null);
});

test("stale, future-dated or tampered hand-offs are ignored or cleaned", () => {
  store.clear();
  saveHandoff({ exam: "neet", ranks: { neetAir: { low: 100, high: 200 } }, category: "ews", pwd: false, homeState: "Bihar" }, 0);
  assert.equal(takeHandoff(31 * 60 * 1000), null);
  store.set(
    "origin:college-finder:handoff",
    JSON.stringify({ savedAt: 10, exam: "neet", category: "general", pwd: "yes", homeState: "Atlantis", ranks: { neetAir: { low: 5, high: 1 }, jeeMainCrl: { low: 1, high: 2 }, evil: 1 } }),
  );
  const h = takeHandoff(20);
  assert.deepEqual(h, { exam: "neet", ranks: { jeeMainCrl: { low: 1, high: 2 } }, category: "general", pwd: false, homeState: "" });
  store.set("origin:college-finder:handoff", JSON.stringify({ savedAt: 10, exam: "x", category: "general" }));
  assert.equal(takeHandoff(20), null);
});

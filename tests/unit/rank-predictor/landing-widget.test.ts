/**
 * T6 — landing-page Rank Predictor (V1/percentile-predictor/TEST_CASES.md §T6),
 * the parts that are plain functions: the widget and the page build the same
 * request (so they share one free-check counter and "See full details" is a
 * free repeat), the form survives the trip to /rank-predictor, the dial and the
 * compact chips. Flag on/off, the hero chip and the shared limit end to end are
 * checked in the browser (see the Stage 4 report).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { compactChips, dialFraction, sourcesLine } from "@/components/landing/rank-predictor-widget-model";
import type { Prediction, RankBand } from "@/lib/rank-predictor/types";
import { hashInput } from "@/server/rank-predictor/public-limit";
import { buildPredictInput, marksTotal, type PredictForm } from "@/sections/RankPredictor/form";
import { freeChecksLine } from "@/sections/RankPredictor/login-links";
import { savePending, takePending } from "@/sections/RankPredictor/pending";

// ─── sessionStorage stand-in for pending.ts ─────────────────────────────────
const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  sessionStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

const widgetForm = (over: Partial<PredictForm> = {}): PredictForm => ({
  exam: "neet",
  marks: { physics: "150", chemistry: "160", biology: "320" },
  category: "obc-ncl",
  pwd: false,
  homeState: "Karnataka",
  shift: "",
  ...over,
});

function inputOf(form: PredictForm) {
  const built = buildPredictInput(form);
  assert.ok("input" in built, JSON.stringify(built));
  return built.input;
}

test("T6.4 widget and page send the same body for the same marks → same free-check hash", () => {
  const key = randomBytes(32);
  const fromWidget = inputOf(widgetForm());
  // What the page builds after restoring the widget's pending form.
  savePending({ ...widgetForm(), predict: true, alreadyCounted: true });
  const restored = takePending();
  assert.ok(restored);
  const fromPage = inputOf({ ...restored, source: undefined });
  assert.deepEqual(fromPage, fromWidget);
  assert.equal(hashInput(fromPage, key), hashInput(fromWidget, key));
  assert.deepEqual(fromWidget, {
    exam: "neet",
    marks: { physics: 150, chemistry: 160, biology: 320 },
    category: "obc-ncl",
    pwd: false,
    homeState: "Karnataka",
    jeeMainShift: null,
  });
});

test("home state goes only with NEET, the shift only with JEE Main", () => {
  const jee = inputOf(widgetForm({ exam: "jee-main", marks: { maths: "80", physics: "70", chemistry: "60" }, shift: "" }));
  assert.equal(jee.homeState ?? null, null);
  assert.equal(jee.jeeMainShift ?? null, null);
  const neet = inputOf(widgetForm({ shift: "2024-01-27-S1" }));
  assert.equal(neet.jeeMainShift ?? null, null);
});

test("an empty or out-of-range box names the field (the widget focuses it)", () => {
  const empty = buildPredictInput(widgetForm({ marks: { physics: "", chemistry: "160", biology: "320" } }));
  assert.ok("error" in empty);
  assert.equal(empty.error.field, "marks.physics");
  const tooHigh = buildPredictInput(widgetForm({ marks: { physics: "150", chemistry: "160", biology: "361" } }));
  assert.ok("error" in tooHigh);
  assert.equal(tooHigh.error.field, "marks.biology");
});

test("live total ignores empty and half-typed boxes", () => {
  assert.equal(marksTotal("neet", { physics: "150", chemistry: "-", biology: "" }), 150);
  assert.equal(marksTotal("jee-main", { maths: "-5", physics: "40", chemistry: "60" }), 95);
});

test("pending form: alreadyCounted round-trips, is false by default, and is read once", () => {
  savePending({ ...widgetForm(), predict: true });
  assert.equal(takePending()?.alreadyCounted, false);
  savePending({ ...widgetForm(), predict: true, alreadyCounted: true });
  assert.equal(takePending()?.alreadyCounted, true);
  assert.equal(takePending(), null);
  // A tampered value is not trusted as "true".
  store.set("origin:rank-predictor:pending", JSON.stringify({ ...widgetForm(), predict: true, alreadyCounted: "yes", savedAt: Date.now() }));
  assert.equal(takePending()?.alreadyCounted, false);
});

test("free-checks line under the button (plan §8.4)", () => {
  assert.equal(freeChecksLine(null), "2 free checks today");
  assert.equal(freeChecksLine({ signedIn: false, remainingToday: 2, limit: 2 }), "2 free checks today");
  assert.equal(freeChecksLine({ signedIn: false, remainingToday: 1, limit: 2 }), "1 free check left today");
  assert.match(freeChecksLine({ signedIn: false, remainingToday: 0, limit: 2 }), /No free checks left today.*12:00 am IST/);
});

const band = (low: number, high: number, extra: Partial<RankBand> = {}): RankBand => ({ low, high, quality: "estimate", ...extra });

test("dial: rank 1 at the top, better rank → further right, never off the arc", () => {
  assert.equal(dialFraction("neet", band(1, 1)), 1);
  assert.equal(dialFraction("neet", null), 0);
  const ranks = [10, 1_000, 50_000, 5_00_000, 20_00_000];
  const fs = ranks.map((r) => dialFraction("neet", band(r, r * 1.2)));
  for (let i = 1; i < fs.length; i++) assert.ok(fs[i] < fs[i - 1], `${ranks[i]} should sit left of ${ranks[i - 1]}`);
  // Beyond the list size it stays on the arc.
  assert.equal(dialFraction("jee-advanced", band(9_00_000, 9_50_000)), 0.02);
  for (const f of fs) assert.ok(f >= 0.02 && f <= 1);
});

const prediction = (over: Partial<Prediction>): Prediction =>
  ({
    exam: "neet",
    total: 630,
    marksUsed: { low: 630, high: 630 },
    air: band(20_000, 26_000),
    percentile: null,
    categoryRank: band(8_000, 11_000, { label: "OBC rank" }),
    pwdRank: null,
    stateRank: null,
    stateRankStatus: "not_selected",
    eligibility: null,
    qualifying: null,
    topText: null,
    spread: [],
    notes: [],
    tieBreakNote: "",
    sourceIds: [],
    years: [],
    ...over,
  }) as Prediction;

test("chips: category rank + every state-rank status in the page's words (JEE state rank = Coming soon)", () => {
  const ok = compactChips(prediction({ stateRankStatus: "ok", stateRank: band(900, 1_300, { label: "Karnataka state rank", quality: "rough" }) }));
  assert.deepEqual(ok.map((c) => c.label), ["OBC rank", "Karnataka state rank"]);
  assert.equal(ok[1].band?.quality, "rough");
  const text = (status: Prediction["stateRankStatus"]) => compactChips(prediction({ stateRankStatus: status })).find((c) => c.key === "state")?.text;
  assert.equal(text("coming_soon"), "Coming soon");
  assert.equal(text("not_available"), "Not available for your state yet (we only use official state lists).");
  assert.equal(text("not_selected"), "Pick your home state to see a state rank.");
  assert.deepEqual(compactChips(prediction({ categoryRank: null, stateRankStatus: "coming_soon" })).map((c) => c.key), ["state"]);
});

test("data line: unique publishers, at most two named, date as given (dd/mm/yyyy)", () => {
  assert.equal(sourcesLine([{ publisher: "NTA" }, { publisher: "NTA" }], "11/11/2026"), "Data: NTA · checked 11/11/2026");
  assert.equal(
    sourcesLine([{ publisher: "NTA" }, { publisher: "KEA" }, { publisher: "MCC" }, { publisher: "TN DME" }], "11/11/2026"),
    "Data: NTA · KEA and 2 more · checked 11/11/2026",
  );
});

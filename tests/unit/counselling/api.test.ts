/**
 * T9.10–T9.14 — the college finder API through the real handlers
 * (/api/assessments/counselling/*, the branch the assessments catch-all
 * forwards to). The repository is replaced by the fixture rows; the SQL itself
 * is checked against the local database (plan §15, Stage 6 line).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { stubModules } from "../_module-stubs";
import { matchSeatType } from "../../../src/lib/counselling/match";
import type { CellRound } from "../../../src/lib/counselling/types";

import { cellsFrom, fixtureRows } from "./_fixtures";

let currentUser: { id: string; role: string } | null = { id: "u1", role: "student" };
let flagOn = true;
let limiterCalls = 0;
let failRead = false;

const CELLS: CellRound[] = cellsFrom(fixtureRows("josaa-2026.csv", "csab-2026.csv", "mcc-2025.csv"));

const DATASETS = [...new Map(CELLS.map((c) => [`${c.body}|${c.year}|${c.round}`, c])).values()].map((c) => ({
  body: c.body,
  year: c.year,
  round: c.round,
  roundLabel: c.roundLabel,
  isFinal: c.isFinal,
  sourceUrl: "https://example.test/source",
  publisher: "Official body",
  official: true,
  fetchedOn: "11/11/2026",
  rowCount: 1,
}));

type Q = import("../../../src/server/counselling/repository").CandidateQuery;

function likeToRegex(pattern: string): RegExp {
  const body = pattern.slice(1, -1).replace(/\\([\\%_])/gu, "$1");
  return new RegExp(body.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "iu");
}

stubModules({
  "server-only": {},
  "@/server/feature-flags-runtime": (real: object) => ({ ...real, isFeatureEnabledRuntime: async () => flagOn }),
  "@/server/auth": (real: object) => ({ ...real, resolveTokenToUser: async () => currentUser }),
  "@/lib/rate-limit": (real: object) => ({
    ...real,
    checkRateLimit: async () => {
      limiterCalls += 1;
      return null;
    },
  }),
  "@/server/counselling/repository": (real: object) => ({
    ...real,
    listDatasets: async () => DATASETS,
    listInstituteStates: async () => ["Maharashtra", "Tamil Nadu"],
    readHistory: async () => [],
    readCandidateCells: async (q: Q) => {
      if (failRead) throw new Error("db down");
      const re = q.branchPattern ? likeToRegex(q.branchPattern) : null;
      const cells = CELLS.filter(
        (c) =>
          q.bodies.includes(c.body) &&
          q.years.includes(c.year) &&
          q.seatPairs.some((s) => s.body === c.body && s.seatType === c.seatType) &&
          (q.includePwd || !c.pwd) &&
          (q.includeFemale || c.gender === "neutral") &&
          (!q.instituteTypes.length || q.instituteTypes.includes(c.instituteType)) &&
          (!q.states.length || (c.instituteState !== null && q.states.includes(c.instituteState))) &&
          (!re || re.test(c.program) || re.test(c.institute)) &&
          q.bounds[c.rankBasis] !== null,
      );
      return { cells, truncated: false };
    },
  }),
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handleCounsellingGet, handleCounsellingPost } = require("@/server/counselling/routes") as typeof import("@/server/counselling/routes");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resetCounsellingCache } = require("@/server/counselling/service") as typeof import("@/server/counselling/service");

function get(path: string) {
  const url = `http://localhost/api/assessments/counselling/${path}`;
  return handleCounsellingGet(new Request(url), new URL(url).pathname.split("/").slice(3).filter(Boolean));
}

function post(body: unknown, raw?: string) {
  const url = "http://localhost/api/assessments/counselling/search";
  return handleCounsellingPost(
    new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(body) }),
    ["counselling", "search"],
  );
}

const JEE = { exam: "jee", ranks: { jeeMainCrl: 3000, jeeAdvCrl: 70 }, category: "general", pwd: false, gender: "female", homeState: "Kerala", filters: {}, page: 1, pageSize: 50 };

function reset() {
  currentUser = { id: "u1", role: "student" };
  flagOn = true;
  limiterCalls = 0;
  failRead = false;
  resetCounsellingCache();
}

test("T9.10 logged-out requests answer 401 (meta and search)", async () => {
  reset();
  currentUser = null;
  assert.equal((await get("meta?exam=jee")).status, 401);
  assert.equal((await post(JEE)).status, 401);
});

test("flag off → 404 feature_off before anything else", async () => {
  reset();
  flagOn = false;
  for (const res of [await get("meta?exam=jee"), await post(JEE)]) {
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as { code: string }).code, "feature_off");
  }
});

test("any signed-in role may search (Q9: any self-registered account)", async () => {
  reset();
  currentUser = { id: "t1", role: "teacher" };
  assert.equal((await post(JEE)).status, 200);
});

test("meta lists bodies, years, data date, disclaimer and official links", async () => {
  reset();
  const res = await get("meta?exam=jee");
  assert.equal(res.status, 200);
  const body = (await res.json()) as { bodies: { body: string; years: { year: number }[] }[]; checkedOn: string; disclaimer: string; officialLinks: unknown[] };
  assert.deepEqual(body.bodies.map((b) => b.body), ["josaa", "csab_special"]);
  assert.equal(body.checkedOn, "11/11/2026");
  assert.match(body.disclaimer, /last year's closing ranks; this year will differ/);
  assert.ok(body.officialLinks.length >= 2);
  assert.equal((await get("meta?exam=x")).status, 400);
  assert.equal((await get("meta/extra?exam=jee")).status, 404);
});

type SearchBody = {
  rows: { key: string; band: string; institute: string; instituteType: string; rounds: unknown[] }[];
  total: number;
  counts: Record<string, number>;
  page: number;
  disclaimer: string;
};

test("T9.11 ≤ 50 rows per response, page 2 works, filters narrow", async () => {
  reset();
  const p1 = (await (await post({ ...JEE, pageSize: 5 })).json()) as SearchBody;
  assert.ok(p1.total > 5, `need more than one page, got ${p1.total}`);
  assert.equal(p1.rows.length, 5);
  const p2 = (await (await post({ ...JEE, pageSize: 5, page: 2 })).json()) as SearchBody;
  assert.equal(p2.page, 2);
  assert.ok(p2.rows.length > 0);
  assert.ok(p2.rows.every((r) => !p1.rows.some((x) => x.key === r.key)));
  assert.equal(p1.counts.safe + p1.counts.likely + p1.counts.reach, p1.total);

  const iit = (await (await post({ ...JEE, filters: { instituteTypes: ["IIT"] } })).json()) as SearchBody;
  assert.ok(iit.total > 0 && iit.total < p1.total);
  assert.ok(iit.rows.every((r) => r.instituteType === "IIT"));

  const band = (await (await post({ ...JEE, filters: { band: "reach" } })).json()) as SearchBody;
  assert.ok(band.rows.every((r) => r.band === "reach"));

  const big = await post({ ...JEE, pageSize: 51 });
  assert.equal(big.status, 400);
  const full = (await (await post(JEE)).json()) as SearchBody;
  assert.ok(full.rows.length <= 50);
  assert.match(full.disclaimer, /this year will differ/);
});

test("roundMode final keeps one round per row", async () => {
  reset();
  const each = (await (await post(JEE)).json()) as SearchBody;
  assert.ok(each.rows.some((r) => r.rounds.length > 1));
  const final = (await (await post({ ...JEE, filters: { roundMode: "final" } })).json()) as SearchBody;
  assert.ok(final.rows.every((r) => r.rounds.length === 1));
});

test("T9.12 SQL injection strings in branchQuery are plain text: no error", async () => {
  reset();
  for (const q of ["'; DROP TABLE counselling.cutoffs; --", "%", "_", "\\", "' OR 1=1 --", "Computer"]) {
    const res = await post({ ...JEE, filters: { branchQuery: q } });
    assert.equal(res.status, 200, q);
  }
  const cse = (await (await post({ ...JEE, filters: { branchQuery: "computer" } })).json()) as SearchBody;
  assert.ok(cse.total > 0);
  // Symbols such as % ' ; \ are dropped by the input cleaner, so "%" is the same as no search text.
  const all = (await (await post(JEE)).json()) as SearchBody;
  const pct = (await (await post({ ...JEE, filters: { branchQuery: "%" } })).json()) as SearchBody;
  assert.equal(pct.total, all.total);
  const nothing = (await (await post({ ...JEE, filters: { branchQuery: "zzzz" } })).json()) as SearchBody;
  assert.equal(nothing.total, 0);
});

test("T9.14 200 searches in a row all succeed: only the burst limiter is consulted, no daily cap", async () => {
  reset();
  for (let i = 0; i < 200; i += 1) {
    const res = await post({ ...JEE, ranks: { jeeMainCrl: 1000 + i } });
    assert.equal(res.status, 200);
  }
  assert.equal(limiterCalls, 200);
});

test("bad bodies: invalid JSON 400, over 4 KB 413, unknown action 404", async () => {
  reset();
  assert.equal((await post(null, "{nope")).status, 400);
  assert.equal((await post(null, JSON.stringify({ ...JEE, filters: { branchQuery: "x".repeat(5000) } }))).status, 413);
  const res = await handleCounsellingPost(new Request("http://localhost/x", { method: "POST", body: "{}" }), ["counselling", "other"]);
  assert.equal(res.status, 404);
});

test("a database failure answers 503 and logs nothing the student typed", async () => {
  reset();
  failRead = true;
  const logs: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  try {
    const res = await post({ ...JEE, category: "obc-ncl", homeState: "Tamil Nadu", pwd: true });
    assert.equal(res.status, 503);
  } finally {
    console.error = original;
  }
  assert.ok(logs.length > 0);
  assert.ok(logs.every((l) => !/obc|Tamil|pwd|3000/iu.test(l)), logs.join("\n"));
});

test("NEET search: MCC row for AIR 1,300 is Likely (T9.7 through the API)", async () => {
  reset();
  const res = await post({ exam: "neet", ranks: { neetAir: 1300 }, category: "general", pwd: false, gender: "female", homeState: "Kerala", filters: {}, page: 1, pageSize: 50 });
  const body = (await res.json()) as SearchBody & { notes: string[] };
  const bmc = body.rows.find((r) => /Bangalore Medical/.test(r.institute));
  assert.equal(bmc?.band, "likely");
  assert.ok(body.notes.some((n) => /Kerala's state quota list/.test(n)));
  assert.ok(matchSeatType("mcc_ug", "Open", "general"));
});

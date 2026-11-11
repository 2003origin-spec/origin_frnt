/**
 * T9 — counselling engine golden cases (V1/percentile-predictor/TEST_CASES.md
 * §T9) on real fixture rows. With only the final round loaded, Safe uses
 * 0.85 × final closing (plan §11.3).
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  classify,
  expectedNextYear,
  matchCells,
  matchSeatType,
  openedInRound,
  quotaEligible,
  seatTypesFor,
  sortRows,
  summariseCell,
  type MatchInput,
} from "../../../src/lib/counselling/match";
import type { CellRound, CounsellingResultRow } from "../../../src/lib/counselling/types";

import { cellsFrom, fixtureRows } from "./_fixtures";

const JOSAA = fixtureRows("josaa-2026.csv");
const FINAL_ONLY = cellsFrom(JOSAA, (r) => r.round === 5);
const BOTH_ROUNDS = cellsFrom(JOSAA);
const MCC_R1 = cellsFrom(fixtureRows("mcc-2025.csv"));

const r = (n: number) => ({ low: n, high: n });

function input(partial: Partial<MatchInput>): MatchInput {
  return { ranks: {}, category: "general", pwd: false, female: false, homeState: "", ...partial };
}

function find(rows: CounsellingResultRow[], institute: RegExp, quota: string, seat = "OPEN", female = false): CounsellingResultRow | undefined {
  return rows.find((x) => institute.test(x.institute) && x.quota === quota && x.seatType === seat && x.femaleOnly === female && !x.pwd && /^Computer Science and Engineering$|^MBBS$/.test(x.program));
}

test("T9.1 JEE Adv CRL 60, OPEN, male → IIT Bombay CSE (closing 67) is Likely", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(60) } }));
  const row = find(rows, /Technology Bombay/, "AI");
  assert.ok(row);
  assert.equal(row.finalClosing, 67);
  assert.equal(row.band, "likely");
  assert.equal(row.rankUsedLabel, "JEE Advanced CRL");
});

test("T9.2 JEE Adv CRL 70 → IIT Bombay CSE is Reach (≤ 1.15 × 67 = 77)", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(70) } }));
  assert.equal(find(rows, /Technology Bombay/, "AI")?.band, "reach");
  const { rows: out } = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(78) } }));
  assert.equal(find(out, /Technology Bombay/, "AI"), undefined);
});

test("T9.3 JEE Main CRL 1,300, home state Tamil Nadu → NIT Trichy CSE in HS (closing 4,015) is Safe", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(1300) }, homeState: "Tamil Nadu" }));
  const hs = find(rows, /Tiruchirappalli/, "HS");
  assert.equal(hs?.finalClosing, 4015);
  assert.equal(hs?.band, "safe");
  assert.equal(hs?.quotaLabel, "Home state");
  // JoSAA Business Rules: a home-state candidate is not eligible for that NIT's OS seats,
  // so the OS cell (1,373) is NOT offered (TEST_CASES T9.3 says "also shown": see the Stage 6 report).
  assert.equal(find(rows, /Tiruchirappalli/, "OS"), undefined);
});

test("T9.4 same rank, home state Kerala → NIT Trichy CSE only in OS (closing 1,373), Likely", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(1300) }, homeState: "Kerala" }));
  const os = find(rows, /Tiruchirappalli/, "OS");
  assert.equal(os?.finalClosing, 1373);
  assert.equal(os?.band, "likely");
  assert.equal(find(rows, /Tiruchirappalli/, "HS"), undefined);
});

test("T9.5 JEE Main OBC-NCL category rank 450, OS → NIT Trichy CSE OS OBC-NCL (closing 459) is Likely", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCategory: r(450) }, category: "obc-ncl", homeState: "Kerala" }));
  const obc = find(rows, /Tiruchirappalli/, "OS", "OBC-NCL");
  assert.equal(obc?.finalClosing, 459);
  assert.equal(obc?.band, "likely");
  assert.equal(obc?.rankUsedLabel, "JEE Main category rank");
});

test("T9.5b without a category rank, category seats are skipped and the missing rank is named", () => {
  const out = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(1300) }, category: "obc-ncl", homeState: "Kerala" }));
  assert.ok(out.missingRanks.includes("JEE Main category rank"));
  assert.equal(find(out.rows, /Tiruchirappalli/, "OS", "OBC-NCL"), undefined);
});

test("T9.6 female student: female-only and gender-neutral cells both shown, female pool marked", () => {
  const female = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(360) }, female: true }));
  const pools = female.rows.filter((x) => /Bombay/.test(x.institute) && x.quota === "AI" && x.seatType === "OPEN" && !x.pwd);
  assert.ok(pools.some((x) => x.femaleOnly));
  const male = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(300) } }));
  assert.ok(male.rows.every((x) => !x.femaleOnly));
  // Female pool closes later (395 vs 67): rank 360 reaches only the female-only cell (Likely: 336 < 360 ≤ 395).
  assert.equal(find(female.rows, /Technology Bombay/, "AI", "OPEN", true)?.band, "likely");
  assert.equal(find(female.rows, /Technology Bombay/, "AI", "OPEN", false), undefined);
});

test("T9.7 NEET AIR 1,300, Open, AIQ, 2025 R1 → Bangalore Medical College MBBS (closing 1,338) is Likely", () => {
  const { rows } = matchCells(MCC_R1, input({ ranks: { neetAir: r(1300) } }));
  const bmc = rows.find((x) => /Bangalore Medical/.test(x.institute) && x.seatType === "Open" && x.quota === "All India");
  assert.equal(bmc?.finalClosing, 1338);
  assert.equal(bmc?.band, "likely");
  assert.equal(bmc?.quotaLabel, "All India");
});

test("T9.8 NEET AIR 1,500 → Reach (≤ 1.15 × 1,338 = 1,538)", () => {
  const { rows } = matchCells(MCC_R1, input({ ranks: { neetAir: r(1500) } }));
  assert.equal(rows.find((x) => /Bangalore Medical/.test(x.institute) && x.seatType === "Open")?.band, "reach");
});

test("T9.9 GO / JK / LA quotas only for Goa, J&K and Ladakh", () => {
  const goaHome = ["Dadra and Nagar Haveli and Daman and Diu", "Goa", "Lakshadweep"];
  assert.equal(quotaEligible("josaa", "GO", "Goa", goaHome), true);
  assert.equal(quotaEligible("josaa", "GO", "Kerala", goaHome), false);
  assert.equal(quotaEligible("josaa", "HS", "Goa", goaHome), false, "Goa students use GO, not HS");
  assert.equal(quotaEligible("josaa", "HS", "Lakshadweep", goaHome), true);
  assert.equal(quotaEligible("josaa", "OS", "Goa", goaHome), false);
  const sgr = ["Jammu and Kashmir", "Ladakh"];
  assert.equal(quotaEligible("josaa", "JK", "Jammu and Kashmir", sgr), true);
  assert.equal(quotaEligible("josaa", "JK", "Punjab", sgr), false);
  assert.equal(quotaEligible("josaa", "LA", "Ladakh", sgr), true);
  assert.equal(quotaEligible("josaa", "OS", "Ladakh", sgr), false);
  assert.equal(quotaEligible("josaa", "OS", "Punjab", sgr), true);
  assert.equal(quotaEligible("csab_special", "Home State for Goa", "Goa", goaHome), true);
  assert.equal(quotaEligible("csab_special", "DASA-CIWG", "Goa", goaHome), false);

  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(60000) }, homeState: "Goa" }));
  const quotas = new Set(rows.filter((x) => /Goa/.test(x.institute)).map((x) => x.quota));
  assert.ok(!quotas.has("OS") && !quotas.has("HS"));
  const { rows: sg } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(60000) }, homeState: "Kerala" }));
  assert.ok(sg.filter((x) => /Srinagar|Goa/.test(x.institute)).every((x) => x.quota === "OS"));
});

test("no home state: OS seats only, HS never", () => {
  assert.equal(quotaEligible("josaa", "HS", "", ["Tamil Nadu"]), false);
  assert.equal(quotaEligible("josaa", "OS", "", ["Tamil Nadu"]), true);
});

test("MCC quotas: open ones for all, domicile ones only for that state, special ones never", () => {
  assert.equal(quotaEligible("mcc_ug", "All India", "", []), true);
  assert.equal(quotaEligible("mcc_ug", "Deemed/Paid Seats Quota", "Bihar", []), true);
  assert.equal(quotaEligible("mcc_ug", "Delhi University Quota", "Delhi", []), true);
  assert.equal(quotaEligible("mcc_ug", "Delhi University Quota", "Bihar", []), false);
  assert.equal(quotaEligible("mcc_ug", "Non-Resident Indian", "Delhi", []), false);
  assert.equal(quotaEligible("mcc_ug", "Employees State Insurance Scheme(ESI)", "Delhi", []), false);
  assert.equal(quotaEligible("state_mh", "STATE", "Maharashtra", ["Maharashtra"]), true);
  assert.equal(quotaEligible("state_mh", "STATE", "Gujarat", ["Maharashtra"]), false);
  assert.equal(quotaEligible("state_rj", "NRI", "Rajasthan", ["Rajasthan"]), false);
});

test("state seat codes: Maharashtra (W) seats are women-only; unknown codes are not guessed", () => {
  assert.deepEqual(matchSeatType("state_mh", "OPEN (W)", "general"), { kind: "open", femaleOnly: true, stateList: true });
  assert.deepEqual(matchSeatType("state_mh", "SEBC", "obc-ncl"), null);
  assert.equal(matchSeatType("state_rj", "OB", "obc-ncl"), null);
  assert.ok(seatTypesFor("state_mh", "sc").includes("SC (W)"));
  const mh = cellsFrom(fixtureRows("state-mh-2026.csv"));
  const out = matchCells(mh, input({ ranks: { neetAir: r(40000) }, homeState: "Maharashtra" }));
  assert.ok(out.rows.every((x) => !x.femaleOnly));
  const outF = matchCells(mh, input({ ranks: { neetAir: r(40000) }, homeState: "Maharashtra", female: true }));
  assert.ok(outF.rows.length >= out.rows.length);
});

test("PwD seats need the PwD rank; non-PwD students never see them", () => {
  const notPwd = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(5000) } }));
  assert.ok(notPwd.rows.every((x) => !x.pwd));
  const pwdNoRank = matchCells(FINAL_ONLY, input({ ranks: { jeeAdvCrl: r(5000) }, pwd: true }));
  assert.ok(pwdNoRank.missingRanks.includes("JEE Advanced PwD rank"));
});

test("round 1 present: Safe uses 0.85 × round-1 closing; 'opened in round N'", () => {
  const { rows } = matchCells(BOTH_ROUNDS, input({ ranks: { jeeAdvCrl: r(60) } }));
  const row = find(rows, /Technology Bombay/, "AI");
  assert.ok(row);
  assert.deepEqual(row.rounds.map((x) => x.round), [1, 5]);
  assert.ok(row.openedInRound);
  assert.equal(row.finalClosing, 67);
});

test("bands: pessimistic end for Safe, optimistic end for Reach", () => {
  const s = { rounds: [], final: 1000, finalPrep: false, safeBase: 1000, safeBasePrep: false, hasRound1: true };
  assert.equal(classify(s, { low: 800, high: 850 }), "safe");
  assert.equal(classify(s, { low: 800, high: 900 }), "likely");
  assert.equal(classify(s, { low: 1100, high: 1300 }), "reach");
  assert.equal(classify(s, { low: 1200, high: 1300 }), null);
  assert.equal(classify({ ...s, finalPrep: true }, r(999999)), "likely");
  assert.equal(classify({ ...s, safeBasePrep: true }, r(999999)), "safe");
});

test("derived cells (MCC) take the highest closing across rounds as final", () => {
  const cell = (round: number, closing: number): CellRound => ({ ...MCC_R1[0], round, closingRank: closing, isFinal: round === 4, derived: "from_allotments" });
  const sum = summariseCell([cell(1, 1338), cell(2, 1642), cell(3, 1549), cell(4, 900)]);
  assert.equal(sum.final, 1642);
  assert.equal(sum.safeBase, 1338);
  assert.deepEqual(openedInRound(sum.rounds, 1500), { round: 2, label: MCC_R1[0].roundLabel });
});

test("trend and next-year hints are text only", () => {
  assert.match(expectedNextYear("IIT", 67, 2026, false) ?? "", /^2027: closing rank maybe around 71 /);
  assert.equal(expectedNextYear("STATE", 5000, 2026, false), null);
  assert.equal(expectedNextYear("IIT", 67, 2026, true), null);
});

test("sorting: Safe → Likely → Reach, most competitive first inside a group", () => {
  const { rows } = matchCells(FINAL_ONLY, input({ ranks: { jeeMainCrl: r(20000) }, homeState: "Kerala" }));
  const sorted = sortRows(rows, "competitive");
  const order = { safe: 0, likely: 1, reach: 2 };
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1];
    const b = sorted[i];
    assert.ok(order[a.band] < order[b.band] || (a.band === b.band && a.finalClosing <= b.finalClosing));
  }
});

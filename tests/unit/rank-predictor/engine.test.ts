/**
 * T2 — Rank Predictor engine on the REAL Stage 1 clean data
 * (V1/percentile-predictor/TEST_CASES.md §T2). "≈" in the test sheet means:
 * inside the predicted range, or within the stated tolerance.
 */

import test from "node:test";
import assert from "node:assert/strict";

import jeeAdvancedJson from "@/lib/rank-predictor/data/jee-advanced.json";
import jeeMainJson from "@/lib/rank-predictor/data/jee-main.json";
import neetJson from "@/lib/rank-predictor/data/neet.json";
import { eligibilityStatus, jeeAdvQualification } from "@/lib/rank-predictor/eligibility";
import { lookupRange } from "@/lib/rank-predictor/interpolate";
import {
  jeeAdvRankForYear,
  jeeMainPercentileBand,
  jeeMainRankAt,
  jeeMainShiftPercentiles,
  neetAirForYear,
  neetProportionalStateRank,
  neetStateRankFromList,
  predict,
  stateMeritToAir,
} from "@/lib/rank-predictor/predict";
import { EXAM_SUBJECTS } from "@/lib/rank-predictor/subjects";
import { closingTrendHint } from "@/lib/rank-predictor/trend";
import type { JeeAdvancedData, JeeMainData, NeetData, PredictInput, Prediction, RankPredictorData } from "@/lib/rank-predictor/types";
import { validatePredictRequest } from "@/lib/rank-predictor/validate";

const neet = neetJson as unknown as NeetData;
const jeeMain = jeeMainJson as unknown as JeeMainData;
const jeeAdv = jeeAdvancedJson as unknown as JeeAdvancedData;
const data: RankPredictorData = { neet, "jee-main": jeeMain, "jee-advanced": jeeAdv };

const near = (actual: number, expected: number, tolerance: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} not within ±${tolerance} of ${expected}`);
const within = (actual: number, expected: number, pct: number, what: string) =>
  near(actual, expected, Math.abs(expected) * pct, what);
const contains = (range: { low: number; high: number }, value: number, what: string) =>
  assert.ok(range.low <= value && value <= range.high, `${what}: ${value} not in ${range.low}–${range.high}`);

const year = <T extends { year: number }>(years: T[], y: number) => years.find((entry) => entry.year === y)!;
const shift = (id: string) => jeeMainShiftPercentiles(jeeMain, 0).find((s) => s.shift.id === id)!.shift;
const pctAt = (id: string, marks: number) => {
  const r = lookupRange(shift(id).points, marks);
  return (r.lo + r.hi) / 2;
};

function neetInput(p: number, c: number, b: number, extra: Partial<PredictInput> = {}): PredictInput {
  return { exam: "neet", marks: { physics: p, chemistry: c, biology: b }, category: "general", pwd: false, ...extra };
}
function jmInput(total: number, extra: Partial<PredictInput> = {}): PredictInput {
  const m = Math.round(total / 3);
  return { exam: "jee-main", marks: { maths: total - 2 * m, physics: m, chemistry: m }, category: "general", pwd: false, ...extra };
}
function advInput(m: number, p: number, c: number, extra: Partial<PredictInput> = {}): PredictInput {
  return { exam: "jee-advanced", marks: { maths: m, physics: p, chemistry: c }, category: "general", pwd: false, ...extra };
}

// ─── Golden cases ────────────────────────────────────────────────────────────

test("T2.1 JEE Main 2024 27 Jan S1, 236 marks ≈ 99.03 percentile", () => {
  near(pctAt("2024-01-27-S1", 236), 99.027, 0.01, "percentile");
  const band = jeeMainPercentileBand(jeeMain, { low: 236, high: 236 }, "2024-01-27-S1")!;
  contains(band.band, 99.027, "known-shift band");
});

test("T2.2 JEE Main 2024 27 Jan S1, 150 marks ≈ 91.95", () => {
  near(pctAt("2024-01-27-S1", 150), 91.95, 0.01, "percentile");
});

test("T2.3 JEE Main 2024 1 Feb S1, 150 marks ≈ 98.54", () => {
  near(pctAt("2024-02-01-S1", 150), 98.54, 0.01, "percentile");
});

test("T2.4 JEE Main 150 marks, shift not sure: trimmed band covers 92–98.5", () => {
  const all = jeeMainShiftPercentiles(jeeMain, 150).map((s) => s.percentile).sort((a, b) => a - b);
  const { band } = jeeMainPercentileBand(jeeMain, { low: 150, high: 150 }, null)!;
  assert.ok(band.low >= all[1] - 1e-9, "low end ≥ second-lowest shift");
  assert.ok(band.high <= all[all.length - 2] + 1e-9, "high end ≤ second-highest shift");
  assert.ok(band.low <= 93.3 && band.high >= 98.5, `band ${band.low}–${band.high} spans 92–98.5 after trimming`);
});

const crl2026 = year(jeeMain.years, 2026).rankTables!.CRL as [number, number][];

test("T2.5 JEE Main 99.90 percentile → CRL ≈ 1,581 (2026), formula within 5%", () => {
  const r = jeeMainRankAt(crl2026, 99.9, 1538468);
  near(r.rank, 1581, 1, "CRL");
  within(0.001 * 1538468, r.rank, 0.05, "formula check");
});

test("T2.6 JEE Main 99.0 / 95.06 / 79.99 percentile → CRL ≈ 16,015 / 77,520 / 3,14,558 (2026)", () => {
  near(jeeMainRankAt(crl2026, 99.0, 1538468).rank, 16015, 1, "99.0");
  near(jeeMainRankAt(crl2026, 95.06, 1538468).rank, 77520, 1, "95.06");
  near(jeeMainRankAt(crl2026, 79.99, 1538468).rank, 314558, 1, "79.99");
});

test("T2.7 JEE Main ≈ 95 percentile → OBC-NCL ≈ 24,758 · EWS ≈ 11,535 · SC ≈ 2,748 (2026)", () => {
  const t = year(jeeMain.years, 2026).rankTables!;
  near(jeeMainRankAt(t["OBC-NCL"], 95.03, null).rank, 24758, 1, "OBC-NCL @95.03");
  near(jeeMainRankAt(t.EWS, 95.08, null).rank, 11535, 1, "EWS @95.08");
  near(jeeMainRankAt(t.SC, 95.21, null).rank, 2748, 1, "SC @95.21");
});

test("T2.8 JEE Main eligibility, General, band 93.0–93.8 vs 2026 cut-off 93.4123549 → Borderline", () => {
  assert.equal(year(jeeMain.years, 2026).advCutoff!.UR, 93.4123549);
  assert.equal(eligibilityStatus({ low: 93.0, high: 93.8 }, 93.4123549), "borderline");
  assert.equal(eligibilityStatus({ low: 93.5, high: 94 }, 93.4123549), "likely");
  assert.equal(eligibilityStatus({ low: 90, high: 93.4 }, 93.4123549), "not_eligible");
});

const neet2025 = year(neet.years, 2025);
const neet2026 = year(neet.years, 2026);

test("T2.9 NEET 2025 curve, 502 marks → AIR range contains 49,304–50,368", () => {
  const r = neetAirForYear(neet2025, 502)!;
  assert.ok(r.lo <= 49304 && r.hi >= 50368, `${r.lo}–${r.hi}`);
});

test("T2.10 NEET 2025 curve, 600 / 450 / 300 / 144", () => {
  const cases: [number, number, number][] = [
    [600, 1338, 1411],
    [450, 121036, 122724],
    [300, 441822, 444900],
    [144, 1095526, 1101143],
  ];
  for (const [marks, lo, hi] of cases) {
    const r = neetAirForYear(neet2025, marks)!;
    near(r.lo, lo, 1, `${marks} low`);
    near(r.hi, hi, 1, `${marks} high`);
  }
});

test("T2.11 NEET 2026 curve, 535 marks → AIR ≈ 50,000", () => {
  const r = neetAirForYear(neet2026, 535)!;
  contains({ low: r.lo, high: r.hi + 1 }, 50000, "AIR range");
  within(r.hi, 50000, 0.01, "AIR");
});

test("T2.12 NEET state rank Karnataka (real list), AIR 50,000 → ≈ 2,796", () => {
  const ka = neet.stateLists.KA;
  within((lookupRange(ka.points, 50000).lo + lookupRange(ka.points, 50000).hi) / 2, 2796, 0.01, "KA state rank (list is down-sampled to 1,000 points)");
});

test("T2.13 NEET state rank Tamil Nadu 2026 (real list), 600 marks → ≈ 710–728", () => {
  const r = neetStateRankFromList(neet, "TN", { low: 600, high: 600 })!;
  near(r.range.low, 710, 0, "low");
  near(r.range.high, 728, 0, "high");
  assert.equal(r.list.basis, "marks");
});

test("T2.13b NEET state rank Madhya Pradesh 2026, 550 marks → ≈ 865–892 (AIR ≈ 36,893–37,695)", () => {
  const air = neetAirForYear(neet2026, 550)!;
  within(air.lo, 36893, 0.01, "AIR low");
  within(air.hi, 37695, 0.01, "AIR high");
  const r = neetStateRankFromList(neet, "MP", { low: 550, high: 550 })!;
  within(r.range.low, 865, 0.01, "MP low");
  within(r.range.high, 892, 0.01, "MP high");
});

test("T2.13c Gujarat: a 2026 closing state merit number converts to AIR via the merit list", () => {
  const gj = neet.stateLists.GJ;
  assert.equal(gj.basis, "air");
  // A real row of the list: AIR 977 ↔ state merit 32 (and the inverse is monotone).
  const row = gj.points.find(([, merit]) => merit === 32)!;
  assert.equal(stateMeritToAir(gj, 32), row[0]);
  assert.ok(stateMeritToAir(gj, 1000)! > stateMeritToAir(gj, 100)!);
});

test("T2.14 NEET proportional state rank (Karnataka, AIR 10,000) is rough and ≈ 644 vs the real ≈ 549", () => {
  const prop = neetProportionalStateRank(neet2025, "Karnataka", 10000)!;
  assert.equal(prop.quality, "rough");
  within(prop.rank, 644, 0.01, "proportional");
  // The real KEA list at AIR 10,000 (down-sampled: 549 in the full list, ≈ 560 here).
  const real = lookupRange(neet.stateLists.KA.points, 10000);
  within((real.lo + real.hi) / 2, 549, 0.03, "real list");
  assert.ok(prop.rank > real.hi, "known error: proportional is too high near the top");
  // The product never shows this method: other states say "not available".
  const p = predict(data, neetInput(150, 150, 300, { homeState: "Kerala" }));
  assert.equal(p.stateRankStatus, "not_available");
  assert.equal(p.stateRank, null);
});

// 2026 uses the official JIC report tables. They jump from rank 1 (330 marks) to
// rank 101 (274 marks), so 300 marks is read between those two rows (≈ 55).
test("T2.15 JEE Advanced 2026 CRL: 300 / 150 / 120 / 100 / 92 → ≈ 55 / 5,701 / 13,501 / 23,701 / 29,401", () => {
  const y = year(jeeAdv.years, 2026);
  assert.equal(y.rankTablesQuality, "official");
  for (const [marks, rank] of [
    [300, 55],
    [150, 5701],
    [120, 13501],
    [100, 23701],
    [92, 29401],
  ] as const) {
    const each = Math.ceil(marks / 3);
    const r = jeeAdvRankForYear(y, "CRL", [each, each, marks - 2 * each], marks)!;
    assert.ok(r.qualified);
    contains({ low: Math.floor(r.lo), high: Math.ceil(r.hi) }, rank, `${marks} marks`);
  }
});

test("T2.16 JEE Advanced 2026 qualification (CRL): 8/8/8 + 92 qualifies, 7/40/45 does not", () => {
  const y2026 = [year(jeeAdv.years, 2026)];
  assert.equal(jeeAdvQualification(y2026, "general", false, [8, 8, 76], 92)!.years[0].qualifies, true);
  const bad = jeeAdvQualification(y2026, "general", false, [7, 40, 45], 92)!;
  assert.equal(bad.years[0].qualifies, false);
  assert.match(bad.years[0].reason!, /at least 8 in every subject/);
});

test("T2.17 JEE Advanced total 100, subjects ≥ 10 → qualifies 2023, 2025, 2026; not 2024 → 3 of 4", () => {
  const q = jeeAdvQualification(jeeAdv.years, "general", false, [34, 33, 33], 100)!;
  const by = Object.fromEntries(q.years.map((y) => [y.year, y.qualifies]));
  assert.deepEqual(by, { 2023: true, 2024: false, 2025: true, 2026: true });
  assert.equal(q.summary, "Qualifies in 3 of 4 recent years");
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

test("T2.18 NEET all zeros: valid, AIR near the bottom, below the qualifying cut-off", () => {
  const p = predict(data, neetInput(0, 0, 0));
  assert.ok(p.air);
  assert.ok(p.air!.low > 1_000_000, `AIR low ${p.air!.low}`);
  assert.equal(p.qualifying!.status, "below");
  assert.match(p.qualifying!.summary, /Below the qualifying cut-off in recent years/);
});

test("T2.19 Full marks: never rank 0 or negative, band starts at 1, 'Top ~N' text", () => {
  for (const input of [neetInput(180, 180, 360), jmInput(300), advInput(120, 120, 120)]) {
    const p = predict(data, input);
    assert.equal(p.air!.low, 1, `${input.exam} band starts at 1`);
    assert.ok(p.air!.high >= 1);
    assert.match(p.topText ?? "", /^Top ~\d+/, input.exam);
  }
});

test("T2.20 Negative totals (NEET −180, JEE Main −75): accepted, clamped, rough", () => {
  for (const input of [neetInput(-45, -45, -90), jmInput(-75)]) {
    assert.equal(validatePredictRequest(input).ok, true, `${input.exam} validates`);
    const p = predict(data, input);
    assert.ok(p.air, input.exam);
    assert.equal(p.air!.quality, "rough", `${input.exam} AIR is rough`);
    assert.ok(p.air!.high >= p.air!.low);
  }
  const jm = predict(data, jmInput(-75));
  const bottom = Math.max(...year(jeeMain.years, 2024).shifts!.map((s) => s.points[0][1]));
  assert.ok(jm.percentile!.high <= bottom + 1e-9, "clamped to the lowest table points");
});

test("T2.21 Subject above max → validation error naming the field", () => {
  const cases: [unknown, string][] = [
    [{ ...neetInput(181, 0, 0) }, "marks.physics"],
    [{ ...jmInput(0), marks: { maths: 101, physics: 0, chemistry: 0 } }, "marks.maths"],
    [{ ...advInput(0, 121, 0) }, "marks.physics"],
  ];
  for (const [body, field] of cases) {
    const r = validatePredictRequest(body);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.field, field);
  }
});

test("T2.22 Non-integer or NaN marks → validation error", () => {
  for (const bad of [10.5, Number.NaN, "50", null, Infinity]) {
    const r = validatePredictRequest({ ...neetInput(0, 0, 0), marks: { physics: bad, chemistry: 0, biology: 0 } });
    assert.equal(r.ok, false, String(bad));
    assert.equal(!r.ok && r.field, "marks.physics");
  }
});

test("T2.23 Same NEET total, Biology 340 vs 300: same AIR range; tie-break note says higher Biology ranks first", () => {
  const a = predict(data, neetInput(100, 100, 340));
  const b = predict(data, neetInput(120, 120, 300));
  assert.equal(a.total, b.total);
  assert.deepEqual(a.air, b.air);
  assert.match(a.tieBreakNote, /higher Biology marks rank first/);
});

test("T2.24 A missing year (JEE Main 2025 shift tables absent, NEET 2026 curve removed) is skipped and noted", () => {
  const jmCopy = structuredClone(jeeMain);
  jmCopy.years = jmCopy.years.filter((y) => y.year !== 2025);
  const p = predict({ ...data, "jee-main": jmCopy }, jmInput(150));
  assert.ok(p.percentile);
  assert.ok(p.notes.some((n) => n.includes("2026")), "2026 estimate year noted");
  assert.ok(!p.notes.some((n) => n.includes("2025")));
  assert.ok(predict(data, jmInput(150)).notes.some((n) => /2025: NTA published no shift-wise tables/.test(n)));

  const neetCopy = structuredClone(neet);
  year(neetCopy.years, 2026).marksToAir = null;
  const q = predict({ ...data, neet: neetCopy }, neetInput(150, 150, 250));
  assert.deepEqual(q.years, [2025]);
  assert.ok(q.notes.some((n) => /2026 skipped/.test(n)));
});

test("T2.25 Thin data: short category list or no point within ±15 marks → rough + not enough data", () => {
  // JEE Main 2026 CRL-PwD has 19 points (< 50).
  const p = predict(data, jmInput(150, { pwd: true }));
  assert.equal(p.pwdRank!.quality, "rough");
  assert.equal(p.pwdRank!.notEnoughData, true);
  // NEET 0 marks: no curve point within ±15 marks in either year.
  const q = predict(data, neetInput(0, 0, 0));
  assert.equal(q.air!.notEnoughData, true);
  assert.equal(q.air!.quality, "rough");
});

function allPredictions(): Prediction[] {
  const out: Prediction[] = [];
  for (let t = -180; t <= 720; t += 7) out.push(predict(data, neetInput(Math.round(t / 4), Math.round(t / 4), t - 2 * Math.round(t / 4), { category: "obc-ncl", homeState: "Karnataka" })));
  for (let t = -75; t <= 300; t += 5) out.push(predict(data, jmInput(t, { category: "sc", pwd: true })));
  for (let t = 0; t <= 360; t += 6) out.push(predict(data, advInput(t / 3, t / 3, t / 3, { category: "ews" })));
  return out;
}

test("T2.26 Range ordering: low ≤ high, ranks ≥ 1, percentile in [0, 100]", () => {
  for (const p of allPredictions()) {
    for (const band of [p.air, p.categoryRank, p.pwdRank, p.stateRank]) {
      if (!band) continue;
      assert.ok(band.low >= 1 && band.low <= band.high, `${p.exam} ${p.total}: ${band.label} ${band.low}–${band.high}`);
    }
    if (p.percentile) {
      assert.ok(p.percentile.low >= 0 && p.percentile.high <= 100 && p.percentile.low <= p.percentile.high, `${p.exam} ${p.total} percentile`);
    }
    assert.ok(p.marksUsed.low <= p.marksUsed.high);
  }
});

test("T2.27 Monotonic: the AIR centre never increases when marks increase (every exam, full range)", () => {
  const sweep = (exam: PredictInput["exam"], from: number, to: number, make: (t: number) => PredictInput) => {
    let prev = Number.POSITIVE_INFINITY;
    for (let t = from; t <= to; t += 1) {
      const air = predict(data, make(t)).air;
      if (!air) continue;
      const centre = (air.low + air.high) / 2;
      assert.ok(centre <= prev + 1e-6, `${exam}: centre rose at ${t} marks (${prev} → ${centre})`);
      prev = centre;
    }
  };
  sweep("neet", -180, 720, (t) => neetInput(Math.floor(t / 4), Math.floor(t / 4), t - 2 * Math.floor(t / 4)));
  sweep("jee-main", -75, 300, (t) => jmInput(t));
  sweep("jee-advanced", 0, 360, (t) => advInput(Math.floor(t / 3), Math.floor(t / 3), t - 2 * Math.floor(t / 3)));
});

test("T2.28 JEE Advanced from an Origin 198-mark mock: subject 33/66 → 60/120, rough", async () => {
  const { fillFromAttempt, summariseAttempt } = await import("@/lib/rank-predictor/attempt-mapping");
  const summary = summariseAttempt({
    id: "r1",
    title: "JEE Advanced mock",
    createdAt: "2026-11-01T10:00:00Z",
    score: 99,
    totalMarks: 198,
    subjectStats: {
      physics: { score: 33, total_marks: 66 },
      chemistry: { score: 33, total_marks: 66 },
      mathematics: { score: 33, totalMarks: 66 },
    },
    examPreset: "jee-advanced",
    assignmentId: null,
  });
  const fill = fillFromAttempt(summary, "jee-advanced");
  assert.deepEqual(Object.fromEntries(Object.entries(fill.marks).map(([k, v]) => [k, v.value])), { physics: 60, chemistry: 60, maths: 60 });
  assert.equal(fill.quality, "rough");
  const p = predict(data, advInput(60, 60, 60, { source: { kind: "attempt", resultId: "r1" } }));
  assert.equal(p.air!.quality, "rough");
  assert.ok(p.notes.some((n) => /198-mark/.test(n)));
});

test("T2.29 PwD: uses the PwD table where present, otherwise rough + note", () => {
  // JEE Main OBC-NCL-PwD: no 2026 table → 2024's, rough + note.
  const p = predict(data, jmInput(150, { category: "obc-ncl", pwd: true }));
  assert.equal(p.pwdRank!.label, "OBC-NCL-PwD rank");
  assert.equal(p.pwdRank!.quality, "rough");
  assert.ok(p.notes.some((n) => /OBC-NCL-PwD/.test(n) && /2024/.test(n)));
  // JEE Advanced has no OBC-NCL-PwD table at all → CRL-PwD, rough + note.
  const a = predict(data, advInput(40, 40, 40, { category: "obc-ncl", pwd: true }));
  assert.equal(a.pwdRank!.label, "CRL-PwD rank");
  assert.equal(a.pwdRank!.quality, "rough");
  assert.ok(a.notes.some((n) => /No OBC-NCL-PwD marks-to-rank table/.test(n)));
});

test("T2.30 JEE Main / Advanced with a home state → stateRank null, status coming_soon", () => {
  for (const input of [jmInput(150, { homeState: "Karnataka" }), advInput(50, 50, 50, { homeState: "Karnataka" })]) {
    const p = predict(data, input);
    assert.equal(p.stateRank, null);
    assert.equal(p.stateRankStatus, "coming_soon");
  }
});

test("T2.31 JEE Main percentile 99 with expected2027 16.0 lakh → CRL ≈ 16,660 (± 5%)", () => {
  assert.equal(jeeMain.expected2027.appeared, 1600000);
  // Through the engine path: a band pinned at 99.0 percentile.
  const r = jeeMainRankAt(crl2026, 99.0, 1538468);
  const scaled = (r.rank * jeeMain.expected2027.appeared) / year(jeeMain.years, 2026).appeared;
  within(scaled, 16660, 0.05, "scaled CRL");
  // And the full prediction for a total whose band contains 99.0 contains ≈ 16,660.
  const full = predict(data, jmInput(236, { jeeMainShift: "2024-01-27-S1" }));
  contains({ low: full.air!.low * 0.95, high: full.air!.high * 1.05 }, 16660, "prediction band");
});

test("T2.32 NEET 2027 conversion uses expected2027.appeared ≈ 22.1 lakh, not 2026's 20.0 lakh", () => {
  assert.equal(neet.expected2027.appeared, 2210000);
  // 0 marks pins the worst AIR to everyone who appeared in the 2027 model.
  const p = predict(data, neetInput(0, 0, 0));
  assert.equal(p.air!.high, 2210000);
  assert.ok(p.spread.some((s) => s.text.includes("22,10,000")));
});

test("T2.33 Counselling trend hint: IIT cell whose final closing rose 2 years running", () => {
  // IIT Bhubaneswar CSE, AI, OPEN, Gender-Neutral, final rounds (josaa-2024/25/26.csv).
  const hint = closingTrendHint([
    { year: 2024, closing: 3685 },
    { year: 2025, closing: 4162 },
    { year: 2026, closing: 4899 },
  ]);
  assert.equal(hint, "closing rank rose 2 years in a row");
  assert.equal(closingTrendHint([{ year: 2025, closing: 1 }, { year: 2026, closing: 2 }]), null);
  // Text only: the function takes and returns no band.
  assert.equal(closingTrendHint.length, 1);
});

test("Data parity: EXAM_SUBJECTS matches each data file's subjects", () => {
  for (const file of [neet, jeeMain, jeeAdv]) {
    const boxes = EXAM_SUBJECTS[file.exam];
    assert.deepEqual(boxes.map((b) => b.id), file.subjects.map((s) => s.id), file.exam);
    for (const b of boxes) {
      const s = file.subjects.find((x) => x.id === b.id)!;
      assert.equal(b.max, s.max, `${file.exam} ${b.id} max`);
      if (s.min !== null) assert.equal(b.min, s.min, `${file.exam} ${b.id} min`);
    }
  }
});

test("Data shape: NEET stateShare has real states only (no NTA \"Total\" row) and true shares", () => {
  const withShares = neet.years.filter((y) => y.stateShare);
  assert.ok(withShares.length >= 3, "2024–2026 carry a stateShare block");
  for (const y of withShares) {
    const { appearedTotal, shares } = y.stateShare!;
    const totalLike = Object.keys(shares).filter((k) => /total/i.test(k));
    assert.deepEqual(totalLike, [], `${y.year}: a "Total" row is not a state`);
    const sum = Object.values(shares).reduce((acc, v) => acc + v, 0);
    near(sum, 1, 1e-4, `${y.year}: shares add up to 1`);
    // The state table's own total (2024 differs from the highlights figure by 135).
    within(appearedTotal, y.appeared, 0.001, `${y.year}: appearedTotal is the appeared count, not twice it`);
  }
});

test("NEET proportional state rank: an old file with a \"Total\" row and halved shares gives the same answer", () => {
  for (const y of neet.years.filter((entry) => entry.stateShare)) {
    const { appearedTotal, shares } = y.stateShare!;
    const halved = Object.fromEntries(Object.entries(shares).map(([k, v]) => [k, v / 2]));
    const old: typeof y = { ...y, stateShare: { appearedTotal: appearedTotal * 2, shares: { ...halved, Total: 0.5 } } };
    for (const state of ["Karnataka", "Kerala", "Ladakh", "Andaman and Nicobar Islands"]) {
      for (const air of [1, 10000, 250000, 2000000]) {
        assert.deepEqual(neetProportionalStateRank(old, state, air), neetProportionalStateRank(y, state, air), `${y.year} ${state} ${air}`);
      }
    }
  }
});

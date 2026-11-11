/**
 * T8 — counselling import (V1/percentile-predictor/TEST_CASES.md §T8), the
 * parts that need no database: CSV validation, prep ranks, rank basis, the
 * import plan (dedupe, name variants, content hash). The full-data counts and
 * the second-run check are run against the local DB (plan §15 Stage 6 line).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CSV_COLUMNS, bodyFromFileName, parseCounsellingCsv, parseCsv, validateCsvRecord } from "../../../src/lib/counselling/csv";
import { buildImportPlan, isoFromDmy } from "../../../src/lib/counselling/import-plan";
import { instituteInfo, mccInstituteName, programParts, shortProgram } from "../../../src/lib/counselling/names";

import { fixtureRows, fixtureText } from "./_fixtures";

const HEADER = CSV_COLUMNS.join(",");
const GOOD = 'josaa,2026,5,Round 5,true,Indian Institute of Technology Bombay,"Computer Science and Engineering (4 Years, Bachelor of Technology)",AI,OPEN,false,neutral,jee_adv,1,67,false,false,,false,official';

function fields(line: string): string[] {
  return parseCsv(`${line}\n`)[0];
}

test("T8.1 fixture: JoSAA rows parse, one dataset per round, cell counts kept", () => {
  const parsed = parseCounsellingCsv(fixtureText("josaa-2026.csv"), "josaa");
  assert.equal(parsed.rejected.length, 0);
  const plan = buildImportPlan(parsed.rows);
  const rounds = plan.datasets.map((d) => `${d.body}:${d.round}:${d.isFinal}`);
  assert.deepEqual(rounds, ["josaa:1:false", "josaa:5:true"]);
  assert.equal(plan.datasets.reduce((n, d) => n + d.cells.length, 0), parsed.rows.length);
  assert.equal(plan.institutes.length, 4);
  // Same rows again (a --replace re-run) → same plan, same hashes, no duplicates.
  const again = buildImportPlan(parseCounsellingCsv(fixtureText("josaa-2026.csv"), "josaa").rows);
  assert.deepEqual(again.datasets.map((d) => d.sha256), plan.datasets.map((d) => d.sha256));
});

test("T8.2 bad rows are rejected with the reason (closing < opening, unknown quota)", () => {
  const bad = [
    GOOD.replace(",1,67,", ",90,67,"),
    GOOD.replace(",AI,OPEN,", ",XX,OPEN,"),
    GOOD.replace(",AI,OPEN,", ",,OPEN,"),
    GOOD.replace(",67,false", ",abc,false"),
    GOOD.replace("jee_adv", "jee_main"),
  ];
  const parsed = parseCounsellingCsv([HEADER, GOOD, ...bad].join("\n"));
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(
    parsed.rejected.map((r) => r.line),
    [3, 4, 5, 6, 7],
  );
  assert.match(parsed.rejected[0].error, /closing rank 67 is better than opening rank 90/);
  assert.match(parsed.rejected[1].error, /unknown quota "XX"/);
  assert.match(parsed.rejected[2].error, /unknown quota \(empty\)/);
  assert.match(parsed.rejected[3].error, /bad closing_rank/);
  assert.match(parsed.rejected[4].error, /IIT \/ IISc row must use jee_adv/);
});

test("T8.2 a wrong header stops the file", () => {
  assert.throws(() => parseCounsellingCsv(`body,year\n${GOOD}`), /unexpected header/);
});

test("T8.3 P ranks keep the number and set closing_prep", () => {
  const rows = fixtureRows("josaa-2026-prep.csv");
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.closingPrep, true);
    assert.ok(Number.isInteger(r.closingRank) && r.closingRank > 0);
  }
  // A prep closing may be a smaller number than a main-list opening: that is not an error.
  const res = validateCsvRecord(fields(GOOD.replace(",1,67,false,false", ",500,30,false,true")));
  assert.equal(res.ok, true);
});

test("T8.4 rank basis: IIT/IISc = jee_adv, NIT/IIIT/GFTI = jee_main, MCC = neet_air", () => {
  const rows = fixtureRows("josaa-2026.csv", "mcc-2025.csv", "csab-2026.csv");
  for (const r of rows) {
    if (r.body === "mcc_ug") assert.equal(r.rankBasis, "neet_air");
    else if (r.institute.startsWith("Indian Institute of Technology")) assert.equal(r.rankBasis, "jee_adv");
    else assert.equal(r.rankBasis, "jee_main");
  }
  const iisc = 'josaa,2026,1,Round 1,false,"Indian Institute of Science, Bangalore","Aerospace Engineering (4 Years, Bachelor of Technology)",AI,OPEN,false,neutral,jee_adv,2709,3552,false,false,,false,official';
  assert.equal(validateCsvRecord(fields(iisc)).ok, true);
  const mccWrong = validateCsvRecord(fields(GOOD.replace("josaa,", "mcc_ug,")));
  assert.equal(mccWrong.ok, false);
});

test("MCC tie-printed AIR (1.01) keeps the whole number; other bodies refuse decimals", () => {
  const mcc = 'mcc_ug,2025,1,Round 1,false,"AIIMS, New Delhi,ANSARI NAGAR",MBBS,All India,Open,false,neutral,neet_air,1.01,47,false,false,1,false,from_allotments';
  const res = validateCsvRecord(fields(mcc));
  assert.ok(res.ok);
  if (res.ok) assert.equal(res.row.openingRank, 1);
  assert.equal(validateCsvRecord(fields(GOOD.replace(",67,", ",67.5,"))).ok, false);
});

test("a row for another body than the file is rejected", () => {
  const res = validateCsvRecord(fields(GOOD), "mcc_ug");
  assert.equal(res.ok, false);
});

test("MCC name variants merge into one college; the same raw row twice keeps the bigger list", () => {
  const base = { ...fixtureRows("mcc-2025.csv").find((r) => r.seatType === "Open" && !r.pwd)! };
  const variant = { ...base, institute: "Bangalore Medical College and Research Institute,K R ROAD Seat FORT Page No. 12 24-08-2025 10:00:00 AM", openingRank: 300, closingRank: 1400, seats: 2 };
  const plan = buildImportPlan([base, variant]);
  assert.equal(plan.mergedNameVariants, 1);
  assert.equal(plan.institutes.length, 1);
  const cell = plan.datasets[0].cells[0];
  assert.equal(cell.openingRank, 300);
  assert.equal(cell.closingRank, 1400);
  assert.equal(cell.seats, 17);

  const dup = { ...base, closingRank: 99999, seats: 1 };
  const plan2 = buildImportPlan([base, dup]);
  assert.equal(plan2.droppedDuplicates, 1);
  assert.equal(plan2.datasets[0].cells[0].closingRank, 1338);
});

test("MCC institute names: address and page footer dropped, generic names keep the city", () => {
  assert.equal(mccInstituteName("AIIMS, Raipur,Tatibandh, G E Road, Raipur Chhattisgarh, Pin - 492099 Page No. 47 24-08-2026 09:52:36 AM"), "AIIMS, Raipur");
  assert.equal(
    mccInstituteName("Maharishi Markandeshwar Institute Of Medical Sciences & Research, Mullana, Seat Ambala,M.M. INSTITUTE"),
    "Maharishi Markandeshwar Institute Of Medical Sciences & Research, Mullana, Ambala",
  );
  assert.equal(mccInstituteName("GOVT. MEDICAL COLLEGE,PATIALA,Sangrur road"), "GOVT. MEDICAL COLLEGE, PATIALA");
  assert.equal(mccInstituteName("-PuducherryJIPMER PUDUCHERRY,Dhanvantari Nagar"), "JIPMER PUDUCHERRY");
});

test("institute info: JoSAA type + home states, MCC type from name and quotas", () => {
  const trichy = instituteInfo("josaa", "National Institute of Technology, Tiruchirappalli", [], []);
  assert.equal(trichy.type, "NIT");
  assert.deepEqual(trichy.homeStates, ["Tamil Nadu"]);
  const goa = instituteInfo("josaa", "National Institute of Technology Goa", [], []);
  assert.ok(goa.homeStates.includes("Goa") && goa.homeStates.includes("Lakshadweep"));
  assert.deepEqual(instituteInfo("josaa", "National Institute of Technology, Srinagar", [], []).homeStates, ["Jammu and Kashmir", "Ladakh"]);
  assert.equal(instituteInfo("josaa", "Indian Institute of Science, Bangalore", [], []).type, "IISC");
  assert.equal(instituteInfo("mcc_ug", "AIIMS, Raipur", ["AIIMS, Raipur,Tatibandh, Raipur Chhattisgarh"], ["All India"]).type, "AIIMS");
  assert.equal(instituteInfo("mcc_ug", "AIIMS, Raipur", ["AIIMS, Raipur,Tatibandh, Raipur Chhattisgarh"], ["All India"]).state, "Chhattisgarh");
  assert.equal(instituteInfo("mcc_ug", "X Dental College", [], ["Deemed/Paid Seats Quota"]).type, "MED_DEEMED");
  assert.equal(instituteInfo("state_mh", "GMC, MUMBAI", [], []).state, "Maharashtra");
});

test("program names and dates", () => {
  assert.deepEqual(programParts("Computer Science and Engineering (4 Years, Bachelor of Technology)"), {
    name: "Computer Science and Engineering (4 Years, Bachelor of Technology)",
    degree: "Bachelor of Technology",
    durationYears: 4,
  });
  assert.equal(shortProgram("Computer Science and Engineering (4 Years, Bachelor of Technology)"), "Computer Science and Engineering");
  assert.equal(shortProgram("MBBS"), "MBBS");
  assert.equal(isoFromDmy("11/11/2026"), "2026-11-11");
  assert.equal(isoFromDmy("2026-11-11"), null);
});

test("file names map to bodies", () => {
  assert.deepEqual(bodyFromFileName("josaa-2026.csv"), { body: "josaa", year: 2026 });
  assert.deepEqual(bodyFromFileName("mcc-2025.csv"), { body: "mcc_ug", year: 2025 });
  assert.deepEqual(bodyFromFileName("state-ka-2025.csv"), { body: "state_ka", year: 2025 });
  assert.equal(bodyFromFileName("csab-2026.csv"), null);
  assert.equal(bodyFromFileName("state-zz-2026.csv"), null);
  assert.equal(bodyFromFileName("sources.json"), null);
});

test("CSV parser: quotes, escaped quotes, CRLF, BOM", () => {
  assert.deepEqual(parseCsv('﻿a,"b, c","d ""e"""\r\n1,2,3\r\n'), [
    ["a", "b, c", 'd "e"'],
    ["1", "2", "3"],
  ]);
});

/**
 * Turns validated CSV rows into what the import writes (plan §6.2): datasets
 * (one per body × year × round), institutes, programs and seat cells. Pure,
 * so TEST_CASES T8 runs without a database.
 *
 * Duplicate seat cells inside one dataset:
 *  - the same cell under different raw institute strings (MCC name variants,
 *    see names.ts) are parts of one cell: opening = lowest, closing = highest,
 *    seats added up;
 *  - the same raw row key twice (e.g. MP round 2 prints a 1-seat sub-list next
 *    to the main list) keeps the row with more seats (tie: the lower closing).
 */

import { createHash } from "node:crypto";

import { instituteDisplayName, instituteGroup, instituteInfo, programParts, type InstituteInfo } from "./names";
import type { CounsellingBody, CutoffRow } from "./types";

export type PlannedCell = Omit<CutoffRow, "institute" | "body" | "year" | "round" | "roundLabel" | "isFinal"> & {
  instituteKey: string;
};

export type PlannedDataset = {
  body: CounsellingBody;
  year: number;
  round: number;
  roundLabel: string;
  isFinal: boolean;
  cells: PlannedCell[];
  sha256: string;
};

export type PlannedInstitute = InstituteInfo & { group: string; name: string; key: string };
export type PlannedProgram = { instituteKey: string; name: string; degree: string | null; durationYears: number | null };

export type ImportPlan = {
  datasets: PlannedDataset[];
  institutes: PlannedInstitute[];
  programs: PlannedProgram[];
  mergedNameVariants: number;
  droppedDuplicates: number;
};

export function instituteKeyOf(group: string, name: string): string {
  return `${group}\u0000${name}`;
}

function cellKey(c: Pick<PlannedCell, "instituteKey" | "program" | "quota" | "seatType" | "pwd" | "gender">): string {
  return [c.instituteKey, c.program, c.quota, c.seatType, c.pwd ? 1 : 0, c.gender].join("\u0000");
}

export function buildImportPlan(rows: readonly CutoffRow[]): ImportPlan {
  type Acc = { cell: PlannedCell; raw: string };
  const datasets = new Map<string, { meta: Omit<PlannedDataset, "cells" | "sha256">; cells: Map<string, Acc> }>();
  const instRaw = new Map<string, { group: string; name: string; body: CounsellingBody; raw: Set<string>; quotas: Set<string> }>();
  const programs = new Map<string, PlannedProgram>();
  let mergedNameVariants = 0;
  let droppedDuplicates = 0;

  for (const r of rows) {
    const group = instituteGroup(r.body);
    const name = instituteDisplayName(r.body, r.institute);
    const instituteKey = instituteKeyOf(group, name);
    const inst = instRaw.get(instituteKey) ?? { group, name, body: r.body, raw: new Set<string>(), quotas: new Set<string>() };
    // JoSAA wins over CSAB for the body used to describe a shared institute.
    if (r.body === "josaa") inst.body = "josaa";
    inst.raw.add(r.institute);
    inst.quotas.add(r.quota);
    instRaw.set(instituteKey, inst);

    const pk = `${instituteKey}\u0000${r.program}`;
    if (!programs.has(pk)) {
      const parts = programParts(r.program);
      programs.set(pk, { instituteKey, name: parts.name, degree: parts.degree, durationYears: parts.durationYears });
    }

    const dk = `${r.body}|${r.year}|${r.round}`;
    let ds = datasets.get(dk);
    if (!ds) {
      ds = { meta: { body: r.body, year: r.year, round: r.round, roundLabel: r.roundLabel, isFinal: r.isFinal }, cells: new Map() };
      datasets.set(dk, ds);
    }
    if (r.isFinal) ds.meta.isFinal = true;

    const cell: PlannedCell = {
      instituteKey,
      program: programParts(r.program).name,
      quota: r.quota,
      seatType: r.seatType,
      pwd: r.pwd,
      gender: r.gender,
      rankBasis: r.rankBasis,
      openingRank: r.openingRank,
      closingRank: r.closingRank,
      openingPrep: r.openingPrep,
      closingPrep: r.closingPrep,
      seats: r.seats,
      precisionLost: r.precisionLost,
      derived: r.derived,
    };
    const ck = cellKey(cell);
    const prev = ds.cells.get(ck);
    if (!prev) {
      ds.cells.set(ck, { cell, raw: r.institute });
      continue;
    }
    if (prev.raw !== r.institute) {
      mergedNameVariants += 1;
      const a = prev.cell;
      // Parts of one cell (same college, different printed strings).
      const opening = a.openingRank === null ? cell.openingRank : cell.openingRank === null ? a.openingRank : Math.min(a.openingRank, cell.openingRank);
      const closingFromB = cell.closingRank > a.closingRank;
      prev.cell = {
        ...a,
        openingRank: opening,
        openingPrep: a.openingPrep && cell.openingPrep,
        closingRank: closingFromB ? cell.closingRank : a.closingRank,
        closingPrep: closingFromB ? cell.closingPrep : a.closingPrep,
        seats: a.seats === null && cell.seats === null ? null : (a.seats ?? 0) + (cell.seats ?? 0),
        precisionLost: a.precisionLost || cell.precisionLost,
      };
    } else {
      droppedDuplicates += 1;
      const a = prev.cell;
      const keepNew = (cell.seats ?? 0) > (a.seats ?? 0) || ((cell.seats ?? 0) === (a.seats ?? 0) && cell.closingRank < a.closingRank);
      if (keepNew) prev.cell = cell;
    }
  }

  const plannedDatasets: PlannedDataset[] = [...datasets.values()]
    .map(({ meta, cells }) => {
      const list = [...cells.values()].map((a) => a.cell).sort((x, y) => (cellKey(x) < cellKey(y) ? -1 : cellKey(x) > cellKey(y) ? 1 : 0));
      const sha256 = createHash("sha256").update(JSON.stringify([meta, list])).digest("hex");
      return { ...meta, cells: list, sha256 };
    })
    .sort((a, b) => a.body.localeCompare(b.body) || a.year - b.year || a.round - b.round);

  const institutes: PlannedInstitute[] = [...instRaw.entries()]
    .map(([key, v]) => ({ key, group: v.group, name: v.name, ...instituteInfo(v.body, v.name, [...v.raw], [...v.quotas]) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return { datasets: plannedDatasets, institutes, programs: [...programs.values()], mergedNameVariants, droppedDuplicates };
}

/** dd/mm/yyyy → yyyy-mm-dd (for a DATE column), or null. */
export function isoFromDmy(dmy: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(dmy ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** One raw source of a clean CSV, as written in counselling/sources.json. */
export type SourceEntry = { url?: string; publisher?: string; official?: boolean; fetchedOn?: string; rawFile?: string };

/**
 * The raw file one round's dataset came from: a file named for that round
 * ("round2", "r2"), else one named for a span that holds it ("round1-5"), else
 * the CSV's first source.
 */
export function pickSource(entries: readonly SourceEntry[], round: number): SourceEntry {
  const name = (e: SourceEntry) => (e.rawFile ?? "").split("/").pop() ?? "";
  const roundHit = entries.find((e) => new RegExp(`(?:round|r)${round}(?!\\d)`, "u").test(name(e)));
  if (roundHit) return roundHit;
  const spanHit = entries.find((e) => {
    const m = /(?:round|r)(\d{1,2})-(\d{1,2})(?!\d)/u.exec(name(e));
    return m ? Number(m[1]) <= round && round <= Number(m[2]) : false;
  });
  return spanHit ?? entries[0] ?? {};
}

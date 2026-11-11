/**
 * Test helpers: the committed fixture CSVs (a few real rows per body, public
 * closing ranks only) turned into what the database would hand the engine.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseCounsellingCsv } from "../../../src/lib/counselling/csv";
import { buildImportPlan } from "../../../src/lib/counselling/import-plan";
import { cellKey } from "../../../src/lib/counselling/match";
import type { CellRound, CutoffRow } from "../../../src/lib/counselling/types";

export const FIXTURES = join(new URL(".", import.meta.url).pathname, "fixtures");

export function fixtureText(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

export function fixtureRows(...names: string[]): CutoffRow[] {
  return names.flatMap((n) => {
    const parsed = parseCounsellingCsv(fixtureText(n));
    if (parsed.rejected.length) throw new Error(`fixture ${n} has bad rows: ${JSON.stringify(parsed.rejected)}`);
    return parsed.rows;
  });
}

/** Rows → the CellRound list the repository returns (ids assigned like the import does). */
export function cellsFrom(rows: CutoffRow[], keep: (r: CutoffRow) => boolean = () => true): CellRound[] {
  const plan = buildImportPlan(rows.filter(keep));
  const instituteIds = new Map(plan.institutes.map((inst, i) => [inst.key, { id: i + 1, inst }]));
  const programIds = new Map(plan.programs.map((p, i) => [`${p.instituteKey}\u0000${p.name}`, i + 1]));
  const out: CellRound[] = [];
  for (const ds of plan.datasets) {
    for (const c of ds.cells) {
      const inst = instituteIds.get(c.instituteKey);
      if (!inst) throw new Error("institute missing");
      const cell = {
        body: ds.body,
        year: ds.year,
        round: ds.round,
        roundLabel: ds.roundLabel,
        isFinal: ds.isFinal,
        instituteId: inst.id,
        institute: inst.inst.name,
        instituteType: inst.inst.type,
        instituteState: inst.inst.state,
        homeStates: inst.inst.homeStates,
        programId: programIds.get(`${c.instituteKey}\u0000${c.program}`) ?? 0,
        program: c.program,
        quota: c.quota,
        seatType: c.seatType,
        pwd: c.pwd,
        gender: c.gender,
        rankBasis: c.rankBasis,
        openingRank: c.openingRank,
        closingRank: c.closingRank,
        openingPrep: c.openingPrep,
        closingPrep: c.closingPrep,
        seats: c.seats,
        precisionLost: c.precisionLost,
        derived: c.derived,
      };
      out.push({ ...cell, cellKey: cellKey(cell) });
    }
  }
  return out;
}

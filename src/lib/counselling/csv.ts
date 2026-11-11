/**
 * Clean counselling CSV → validated rows (plan §6.2, TEST_CASES T8). Pure.
 *
 * The clean CSVs come from V1/percentile-predictor/scripts/build (Stage 1).
 * Every row is checked; a bad row is reported with its line number and never
 * imported (T8.2). Ranks: integers > 0. MCC round 1 keeps tie-printed AIRs as
 * printed (1.01, 9743.5, DATA_NOTES "Counselling — MCC"); for an AIR basis we
 * keep the whole-number part, the same thing rounds 2/3 already did.
 */

import {
  COUNSELLING_BODIES,
  DERIVED_KINDS,
  RANK_BASES,
  type CounsellingBody,
  type CutoffRow,
  type DerivedKind,
  type RankBasis,
} from "./types";

export const CSV_COLUMNS = [
  "body",
  "year",
  "round",
  "round_label",
  "is_final",
  "institute",
  "program",
  "quota",
  "seat_type",
  "pwd",
  "gender",
  "rank_basis",
  "opening_rank",
  "closing_rank",
  "opening_prep",
  "closing_prep",
  "seats",
  "precision_lost",
  "derived",
] as const;

/** RFC 4180 CSV (quoted fields, "" escapes, CRLF or LF). Returns rows of fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      row.push(field);
      field = "";
      if (!(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      i += ch === "\r" && src[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

const JOSAA_QUOTAS = new Set(["AI", "HS", "OS", "GO", "JK", "LA"]);
const JOSAA_SEATS = new Set(["OPEN", "EWS", "OBC-NCL", "SC", "ST"]);
// CSAB also prints the foreign-national DASA quotas, as "DASA-…" (2026) or "DC" / "AD" (2025).
const CSAB_SPECIAL_EXTRA_QUOTAS = new Set(["Jammu & Kashmir (UT)", "Home State for Goa", "Ladakh (UT)", "DC", "AD"]);

function bool(value: string): boolean | null {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/** "12345" → 12345; AIR basis also "1.01" → 1. Anything else → null. */
function rank(value: string, basis: RankBasis): number | null {
  if (/^\d{1,8}$/u.test(value)) {
    const n = Number(value);
    return n > 0 ? n : null;
  }
  if (basis === "neet_air" && /^\d{1,8}\.\d{1,4}$/u.test(value)) {
    const n = Math.floor(Number(value));
    return n > 0 ? n : null;
  }
  return null;
}

export type RowResult = { ok: true; row: CutoffRow } | { ok: false; error: string };

/** IITs and IISc Bangalore (in JoSAA from 2026) admit on JEE Advanced ranks. */
export function usesJeeAdvanced(institute: string): boolean {
  const name = institute.trim();
  return (/^Indian Institute\s+of\s+Technology\b/iu.test(name) && !/Information Technology/iu.test(name)) || /^Indian Institute of Science\b/iu.test(name);
}

/** Validate one CSV record (already split into fields, header order = CSV_COLUMNS). */
export function validateCsvRecord(fields: readonly string[], expectedBody?: CounsellingBody): RowResult {
  if (fields.length !== CSV_COLUMNS.length) return { ok: false, error: `expected ${CSV_COLUMNS.length} fields, got ${fields.length}` };
  const f = Object.fromEntries(CSV_COLUMNS.map((c, i) => [c, fields[i].trim()])) as Record<(typeof CSV_COLUMNS)[number], string>;

  if (!(COUNSELLING_BODIES as readonly string[]).includes(f.body)) return { ok: false, error: `unknown body "${f.body}"` };
  const body = f.body as CounsellingBody;
  if (expectedBody && body !== expectedBody) return { ok: false, error: `body "${body}" does not match the file (${expectedBody})` };
  if (!/^\d{4}$/u.test(f.year)) return { ok: false, error: `bad year "${f.year}"` };
  if (!/^\d{1,2}$/u.test(f.round)) return { ok: false, error: `bad round "${f.round}"` };
  if (!(RANK_BASES as readonly string[]).includes(f.rank_basis)) return { ok: false, error: `unknown rank_basis "${f.rank_basis}"` };
  const basis = f.rank_basis as RankBasis;
  if (!(DERIVED_KINDS as readonly string[]).includes(f.derived)) return { ok: false, error: `unknown derived "${f.derived}"` };
  if (f.gender !== "neutral" && f.gender !== "female") return { ok: false, error: `unknown gender "${f.gender}"` };
  if (!f.institute) return { ok: false, error: "empty institute" };
  if (!f.program) return { ok: false, error: "empty program" };
  if (!f.quota) return { ok: false, error: "unknown quota (empty)" };
  if (!f.seat_type) return { ok: false, error: "empty seat_type" };
  if (!f.round_label) return { ok: false, error: "empty round_label" };

  const bools = {
    isFinal: bool(f.is_final),
    pwd: bool(f.pwd),
    openingPrep: bool(f.opening_prep),
    closingPrep: bool(f.closing_prep),
    precisionLost: bool(f.precision_lost),
  };
  for (const [k, v] of Object.entries(bools)) if (v === null) return { ok: false, error: `bad boolean ${k}` };

  // Body rules (T8.4 rank basis; known quotas / seat types where the body has a fixed set).
  if (body === "josaa" || body === "csab_special") {
    const quotaOk = JOSAA_QUOTAS.has(f.quota) || (body === "csab_special" && (CSAB_SPECIAL_EXTRA_QUOTAS.has(f.quota) || f.quota.startsWith("DASA-")));
    if (!quotaOk) return { ok: false, error: `unknown quota "${f.quota}"` };
    if (!JOSAA_SEATS.has(f.seat_type)) return { ok: false, error: `unknown seat_type "${f.seat_type}"` };
    const iit = usesJeeAdvanced(f.institute);
    if (iit && basis !== "jee_adv") return { ok: false, error: "IIT / IISc row must use jee_adv ranks" };
    if (!iit && basis !== "jee_main") return { ok: false, error: "non-IIT row must use jee_main ranks (IIT / IISc use jee_adv)" };
  } else if (body === "csab_neut") {
    if (basis !== "jee_main") return { ok: false, error: "CSAB rows must use jee_main ranks" };
  } else if (body === "mcc_ug") {
    if (basis !== "neet_air") return { ok: false, error: "MCC rows must use neet_air ranks" };
  } else if (basis !== "neet_air" && basis !== "state_rank") {
    return { ok: false, error: "state rows must use neet_air or state_rank" };
  }

  const closing = rank(f.closing_rank, basis);
  if (closing === null) return { ok: false, error: `bad closing_rank "${f.closing_rank}"` };
  let opening: number | null = null;
  if (f.opening_rank !== "") {
    opening = rank(f.opening_rank, basis);
    if (opening === null) return { ok: false, error: `bad opening_rank "${f.opening_rank}"` };
  }
  // A P (preparatory) rank is on a different list, so only same-list ranks compare.
  if (opening !== null && bools.openingPrep === bools.closingPrep && closing < opening) {
    return { ok: false, error: `closing rank ${closing} is better than opening rank ${opening}` };
  }
  let seats: number | null = null;
  if (f.seats !== "") {
    if (!/^\d{1,6}$/u.test(f.seats)) return { ok: false, error: `bad seats "${f.seats}"` };
    seats = Number(f.seats);
  }

  return {
    ok: true,
    row: {
      body,
      year: Number(f.year),
      round: Number(f.round),
      roundLabel: f.round_label,
      isFinal: bools.isFinal as boolean,
      institute: f.institute,
      program: f.program,
      quota: f.quota,
      seatType: f.seat_type,
      pwd: bools.pwd as boolean,
      gender: f.gender,
      rankBasis: basis,
      openingRank: opening,
      closingRank: closing,
      openingPrep: bools.openingPrep as boolean,
      closingPrep: bools.closingPrep as boolean,
      seats,
      precisionLost: bools.precisionLost as boolean,
      derived: f.derived as DerivedKind,
    },
  };
}

export type ParsedFile = {
  rows: CutoffRow[];
  rejected: { line: number; error: string }[];
};

/** Parse a whole clean CSV. Header must match CSV_COLUMNS exactly. */
export function parseCounsellingCsv(text: string, expectedBody?: CounsellingBody): ParsedFile {
  const records = parseCsv(text);
  if (!records.length) throw new Error("empty file");
  const header = records[0].map((h) => h.trim());
  if (header.join(",") !== CSV_COLUMNS.join(",")) {
    throw new Error(`unexpected header: ${header.join(",")}`);
  }
  const rows: CutoffRow[] = [];
  const rejected: { line: number; error: string }[] = [];
  for (let i = 1; i < records.length; i += 1) {
    const res = validateCsvRecord(records[i], expectedBody);
    // Line numbers are 1-based and count the header (no field holds a newline).
    if (res.ok) rows.push(res.row);
    else rejected.push({ line: i + 1, error: res.error });
  }
  return { rows, rejected };
}

/** "josaa-2026.csv" → { body: "josaa", year: 2026 }; "state-ka-2025.csv" → state_ka. */
export function bodyFromFileName(name: string): { body: CounsellingBody; year: number } | null {
  const m = /^(josaa|csab|mcc|state-([a-z]{2}))-(\d{4})\.csv$/u.exec(name);
  if (!m) return null;
  const year = Number(m[3]);
  if (m[1] === "josaa") return { body: "josaa", year };
  if (m[1] === "mcc") return { body: "mcc_ug", year };
  if (m[1] === "csab") return null; // CSAB files mix csab_special and csab_neut: use the body column.
  const body = `state_${m[2]}`;
  return (COUNSELLING_BODIES as readonly string[]).includes(body) ? { body: body as CounsellingBody, year } : null;
}

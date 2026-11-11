import "server-only";

/**
 * Counselling reads (plan §7.3). Parameterised SQL only (OWASP SQL Injection
 * Prevention): every value — bodies, years, seat types, filters, the branch
 * search — is a bind parameter; no string is ever spliced into the SQL.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import type { CellRound, CounsellingBody, DerivedKind, Gender, RankBasis } from "@/lib/counselling/types";
import { cellKey, type CandidateRule } from "@/lib/counselling/match";

import { ensureCounsellingSchema } from "./schema";

/** Hard cap on cell-round rows read for one search (all rounds of all candidate cells). */
export const MAX_CANDIDATE_ROWS = 40_000;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

export type DatasetRow = {
  body: CounsellingBody;
  year: number;
  round: number;
  roundLabel: string;
  isFinal: boolean;
  sourceUrl: string | null;
  publisher: string | null;
  official: boolean;
  fetchedOn: string | null; // dd/mm/yyyy
  rowCount: number;
};

export async function listDatasets(): Promise<DatasetRow[]> {
  await ensureCounsellingSchema();
  const res = await pool().query<{
    body: CounsellingBody;
    year: number;
    round: number;
    round_label: string;
    is_final: boolean;
    source_url: string | null;
    publisher: string | null;
    official: boolean;
    fetched_on: string | null;
    row_count: number;
  }>(
    `SELECT body, year, round, round_label, is_final, source_url, publisher, official,
            to_char(fetched_on, 'DD/MM/YYYY') AS fetched_on, row_count
       FROM counselling.datasets
      WHERE row_count > 0
      ORDER BY body, year, round`,
  );
  return res.rows.map((r) => ({
    body: r.body,
    year: r.year,
    round: r.round,
    roundLabel: r.round_label,
    isFinal: r.is_final,
    sourceUrl: r.source_url,
    publisher: r.publisher,
    official: r.official,
    fetchedOn: r.fetched_on,
    rowCount: r.row_count,
  }));
}

/** Distinct institute states for these bodies' institutes (state filter options). */
export async function listInstituteStates(groups: readonly string[]): Promise<string[]> {
  await ensureCounsellingSchema();
  const res = await pool().query<{ state: string }>(
    "SELECT DISTINCT state FROM counselling.institutes WHERE body = ANY($1::text[]) AND state IS NOT NULL ORDER BY state",
    [groups],
  );
  return res.rows.map((r) => r.state);
}

export type CandidateQuery = {
  bodies: CounsellingBody[];
  years: number[];
  /** (body, seat type, PwD, rank list) open to the student, with their best rank for it. */
  rules: CandidateRule[];
  includeFemale: boolean;
  instituteTypes: string[];
  states: string[];
  /** LIKE pattern (already escaped) or null. */
  branchPattern: string | null;
  reachFactor: number;
};

type CandidateRow = {
  body: CounsellingBody;
  year: number;
  round: number;
  round_label: string;
  is_final: boolean;
  institute_id: number;
  institute: string;
  institute_type: string;
  institute_state: string | null;
  home_states: string[];
  program_id: number;
  program: string;
  quota: string;
  seat_type: string;
  pwd: boolean;
  gender: Gender;
  rank_basis: RankBasis;
  opening_rank: number | null;
  closing_rank: number;
  opening_prep: boolean;
  closing_prep: boolean;
  seats: number | null;
  precision_lost: boolean;
  derived: DerivedKind;
};

/**
 * Every round of every seat cell that could be Safe / Likely / Reach (coarse
 * filter per seat type / PwD pool / rank list; the engine decides). Cells come
 * most sought-after first; when the cap is hit the least sought-after cells are
 * left out whole (never half a cell) and `truncated` is set.
 */
export async function readCandidateCells(q: CandidateQuery): Promise<{ cells: CellRound[]; truncated: boolean }> {
  await ensureCounsellingSchema();
  if (!q.bodies.length || !q.years.length || !q.rules.length) return { cells: [], truncated: false };
  const res = await pool().query<CandidateRow>(
    `WITH rules AS (
       SELECT * FROM unnest($3::text[], $4::text[], $5::boolean[], $6::text[], $7::int[]) AS r(body, seat_type, pwd, basis, bound)
     ),
     base AS (
       SELECT d.body, d.year, d.round, d.round_label, d.is_final,
              i.id AS institute_id, i.name AS institute, i.type AS institute_type, i.state AS institute_state, i.home_states,
              p.id AS program_id, p.name AS program,
              c.quota, c.seat_type, c.pwd, c.gender, c.rank_basis, c.opening_rank, c.closing_rank,
              c.opening_prep, c.closing_prep, c.seats, c.precision_lost, c.derived, r.bound,
              max(c.closing_rank) OVER w AS cell_max,
              bool_or(c.closing_prep) OVER w AS cell_prep
         FROM counselling.cutoffs c
         JOIN counselling.datasets d ON d.id = c.dataset_id
         JOIN rules r ON r.body = d.body AND r.seat_type = c.seat_type AND r.pwd = c.pwd AND r.basis = c.rank_basis
         JOIN counselling.programs p ON p.id = c.program_id
         JOIN counselling.institutes i ON i.id = p.institute_id
        WHERE d.body = ANY($1::text[])
          AND d.year = ANY($2::int[])
          AND ($8::boolean OR c.gender = 'neutral')
          AND (cardinality($9::text[]) = 0 OR i.type = ANY($9::text[]))
          AND (cardinality($10::text[]) = 0 OR i.state = ANY($10::text[]))
          AND ($11::text IS NULL OR p.name ILIKE $11::text OR i.name ILIKE $11::text)
       WINDOW w AS (PARTITION BY d.body, d.year, c.program_id, c.quota, c.seat_type, c.pwd, c.gender)
     )
     SELECT body, year, round, round_label, is_final, institute_id, institute, institute_type, institute_state, home_states,
            program_id, program, quota, seat_type, pwd, gender, rank_basis, opening_rank, closing_rank,
            opening_prep, closing_prep, seats, precision_lost, derived
       FROM base
      WHERE cell_prep OR cell_max * $12::float8 >= bound
      ORDER BY cell_max, body, year, program_id, quota, seat_type, pwd, gender, round
      LIMIT $13`,
    [
      q.bodies,
      q.years,
      q.rules.map((r) => r.body),
      q.rules.map((r) => r.seatType),
      q.rules.map((r) => r.pwd),
      q.rules.map((r) => r.rankBasis),
      q.rules.map((r) => r.bound),
      q.includeFemale,
      q.instituteTypes,
      q.states,
      q.branchPattern,
      q.reachFactor,
      MAX_CANDIDATE_ROWS + 1,
    ],
  );
  const truncated = res.rows.length > MAX_CANDIDATE_ROWS;
  const cells: CellRound[] = res.rows.map((r) => {
    const cell = {
      body: r.body,
      year: r.year,
      round: r.round,
      roundLabel: r.round_label,
      isFinal: r.is_final,
      instituteId: r.institute_id,
      institute: r.institute,
      instituteType: r.institute_type,
      instituteState: r.institute_state,
      homeStates: r.home_states ?? [],
      programId: r.program_id,
      program: r.program,
      quota: r.quota,
      seatType: r.seat_type,
      pwd: r.pwd,
      gender: r.gender,
      rankBasis: r.rank_basis,
      openingRank: r.opening_rank,
      closingRank: r.closing_rank,
      openingPrep: r.opening_prep,
      closingPrep: r.closing_prep,
      seats: r.seats,
      precisionLost: r.precision_lost,
      derived: r.derived,
    };
    return { ...cell, cellKey: cellKey(cell) };
  });
  if (!truncated) return { cells, truncated };
  // Drop the cell the cap cut through, so no cell is judged on some of its rounds.
  const lastKey = cells[cells.length - 1].cellKey;
  return { cells: cells.filter((c) => c.cellKey !== lastKey), truncated };
}

export type HistoryRow = Pick<CellRound, "body" | "year" | "round" | "isFinal" | "programId" | "quota" | "seatType" | "pwd" | "gender" | "closingRank" | "closingPrep" | "derived" | "roundLabel">;

export type HistoryKey = Pick<CellRound, "body" | "programId" | "quota" | "seatType" | "pwd" | "gender">;

/** Every year's rounds of exactly these seat cells (the trend line on the page's rows). */
export async function readHistory(keys: readonly HistoryKey[]): Promise<HistoryRow[]> {
  if (!keys.length) return [];
  await ensureCounsellingSchema();
  const res = await pool().query<{
    body: CounsellingBody;
    year: number;
    round: number;
    round_label: string;
    is_final: boolean;
    program_id: number;
    quota: string;
    seat_type: string;
    pwd: boolean;
    gender: Gender;
    closing_rank: number;
    closing_prep: boolean;
    derived: DerivedKind;
  }>(
    `WITH k AS (
       SELECT * FROM unnest($1::text[], $2::int[], $3::text[], $4::text[], $5::boolean[], $6::text[])
         AS k(body, program_id, quota, seat_type, pwd, gender)
     )
     SELECT d.body, d.year, d.round, d.round_label, d.is_final, c.program_id, c.quota, c.seat_type, c.pwd, c.gender,
            c.closing_rank, c.closing_prep, c.derived
       FROM k
       JOIN counselling.cutoffs c
         ON c.program_id = k.program_id AND c.quota = k.quota AND c.seat_type = k.seat_type AND c.pwd = k.pwd AND c.gender = k.gender
       JOIN counselling.datasets d ON d.id = c.dataset_id AND d.body = k.body`,
    [
      keys.map((k) => k.body),
      keys.map((k) => k.programId),
      keys.map((k) => k.quota),
      keys.map((k) => k.seatType),
      keys.map((k) => k.pwd),
      keys.map((k) => k.gender),
    ],
  );
  return res.rows.map((r) => ({
    body: r.body,
    year: r.year,
    round: r.round,
    roundLabel: r.round_label,
    isFinal: r.is_final,
    programId: r.program_id,
    quota: r.quota,
    seatType: r.seat_type,
    pwd: r.pwd,
    gender: r.gender,
    closingRank: r.closing_rank,
    closingPrep: r.closing_prep,
    derived: r.derived,
  }));
}

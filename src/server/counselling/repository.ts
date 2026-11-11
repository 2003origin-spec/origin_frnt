import "server-only";

/**
 * Counselling reads (plan §7.3). Parameterised SQL only (OWASP SQL Injection
 * Prevention): every value — bodies, years, seat types, filters, the branch
 * search — is a bind parameter; no string is ever spliced into the SQL.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import type { CellRound, CounsellingBody, DerivedKind, Gender, RankBasis } from "@/lib/counselling/types";
import { cellKey } from "@/lib/counselling/match";

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
  /** Allowed (body, seat_type) pairs. */
  seatPairs: { body: CounsellingBody; seatType: string }[];
  includePwd: boolean;
  includeFemale: boolean;
  instituteTypes: string[];
  states: string[];
  /** LIKE pattern (already escaped) or null. */
  branchPattern: string | null;
  /** Smallest rank the student might use per basis (null = no rank for that basis). */
  bounds: Record<RankBasis, number | null>;
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
 * Every round of every seat cell that could be Safe / Likely / Reach for the
 * smallest of the student's ranks (coarse filter; the engine decides). Returns
 * `truncated` when the cap was hit.
 */
export async function readCandidateCells(q: CandidateQuery): Promise<{ cells: CellRound[]; truncated: boolean }> {
  await ensureCounsellingSchema();
  if (!q.bodies.length || !q.years.length || !q.seatPairs.length) return { cells: [], truncated: false };
  const res = await pool().query<CandidateRow>(
    `WITH base AS (
       SELECT d.body, d.year, d.round, d.round_label, d.is_final,
              i.id AS institute_id, i.name AS institute, i.type AS institute_type, i.state AS institute_state, i.home_states,
              p.id AS program_id, p.name AS program,
              c.quota, c.seat_type, c.pwd, c.gender, c.rank_basis, c.opening_rank, c.closing_rank,
              c.opening_prep, c.closing_prep, c.seats, c.precision_lost, c.derived,
              max(c.closing_rank) OVER w AS cell_max,
              bool_or(c.closing_prep) OVER w AS cell_prep
         FROM counselling.cutoffs c
         JOIN counselling.datasets d ON d.id = c.dataset_id
         JOIN counselling.programs p ON p.id = c.program_id
         JOIN counselling.institutes i ON i.id = p.institute_id
        WHERE d.body = ANY($1::text[])
          AND d.year = ANY($2::int[])
          AND (d.body, c.seat_type) IN (SELECT * FROM unnest($3::text[], $4::text[]))
          AND ($5::boolean OR NOT c.pwd)
          AND ($6::boolean OR c.gender = 'neutral')
          AND (cardinality($7::text[]) = 0 OR i.type = ANY($7::text[]))
          AND (cardinality($8::text[]) = 0 OR i.state = ANY($8::text[]))
          AND ($9::text IS NULL OR p.name ILIKE $9::text OR i.name ILIKE $9::text)
       WINDOW w AS (PARTITION BY d.body, d.year, c.program_id, c.quota, c.seat_type, c.pwd, c.gender)
     )
     SELECT body, year, round, round_label, is_final, institute_id, institute, institute_type, institute_state, home_states,
            program_id, program, quota, seat_type, pwd, gender, rank_basis, opening_rank, closing_rank,
            opening_prep, closing_prep, seats, precision_lost, derived
       FROM base
      WHERE (CASE rank_basis WHEN 'jee_adv' THEN $10::int WHEN 'jee_main' THEN $11::int
                             WHEN 'neet_air' THEN $12::int ELSE $13::int END) IS NOT NULL
        AND (cell_prep OR cell_max * $14::float8 >=
             (CASE rank_basis WHEN 'jee_adv' THEN $10::int WHEN 'jee_main' THEN $11::int
                              WHEN 'neet_air' THEN $12::int ELSE $13::int END))
      ORDER BY body, year, program_id, quota, seat_type, pwd, gender, round
      LIMIT $15`,
    [
      q.bodies,
      q.years,
      q.seatPairs.map((s) => s.body),
      q.seatPairs.map((s) => s.seatType),
      q.includePwd,
      q.includeFemale,
      q.instituteTypes,
      q.states,
      q.branchPattern,
      q.bounds.jee_adv,
      q.bounds.jee_main,
      q.bounds.neet_air,
      q.bounds.state_rank,
      q.reachFactor,
      MAX_CANDIDATE_ROWS + 1,
    ],
  );
  const truncated = res.rows.length > MAX_CANDIDATE_ROWS;
  const rows = truncated ? res.rows.slice(0, MAX_CANDIDATE_ROWS) : res.rows;
  return {
    truncated,
    cells: rows.map((r) => {
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
    }),
  };
}

export type HistoryRow = Pick<CellRound, "body" | "year" | "round" | "isFinal" | "programId" | "quota" | "seatType" | "pwd" | "gender" | "closingRank" | "closingPrep" | "derived" | "roundLabel">;

/** Every year's rounds for these programs (the trend line on the page's rows). */
export async function readHistory(bodies: readonly CounsellingBody[], programIds: readonly number[]): Promise<HistoryRow[]> {
  if (!programIds.length) return [];
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
    `SELECT d.body, d.year, d.round, d.round_label, d.is_final, c.program_id, c.quota, c.seat_type, c.pwd, c.gender,
            c.closing_rank, c.closing_prep, c.derived
       FROM counselling.cutoffs c
       JOIN counselling.datasets d ON d.id = c.dataset_id
      WHERE d.body = ANY($1::text[]) AND c.program_id = ANY($2::int[])`,
    [bodies, programIds],
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

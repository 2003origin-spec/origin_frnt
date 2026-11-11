/**
 * Counselling schema DDL (plan V1/PERCENTILE_PREDICTOR_PLAN.md §6.2). No
 * imports, so the import script (scripts/counselling-import.ts), the runtime
 * ensure (./schema.ts) and the parity test can all read it.
 *
 * Mirrors src/db/migrations/20261111_counselling_cutoffs.sql statement for
 * statement; tests/unit/counselling/schema.test.ts pins the two together.
 * NOT in the prebuild allowlist (scripts/run-migrations.mjs): prod gets it on
 * the first counselling request, by the import script, or by running the SQL
 * by hand on Neon (go-live step, plan §6.2).
 *
 * JoSAA and CSAB share institutes (institutes.body = 'josaa'); MCC and each
 * state list keep their own (body = 'mcc_ug' / 'state_xx').
 */

export const COUNSELLING_MIGRATION_ID = "20261111_counselling_cutoffs";
export const COUNSELLING_MIGRATION_NAME = "counselling cut-offs — JoSAA, CSAB, MCC and state quota closing ranks";

export const COUNSELLING_SCHEMA_DDL: readonly string[] = [
  `CREATE SCHEMA IF NOT EXISTS counselling`,
  `CREATE TABLE IF NOT EXISTS counselling.datasets (
  id          SERIAL PRIMARY KEY,
  body        TEXT NOT NULL CHECK (body ~ '^(josaa|csab_special|csab_neut|mcc_ug|state_[a-z]{2})$'),
  year        SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  round       SMALLINT NOT NULL CHECK (round BETWEEN 0 AND 20),
  round_label TEXT NOT NULL,
  is_final    BOOLEAN NOT NULL DEFAULT false,
  source_url  TEXT,
  publisher   TEXT,
  official    BOOLEAN NOT NULL DEFAULT true,
  fetched_on  DATE,
  row_count   INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  sha256      TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (body, year, round)
)`,
  `CREATE TABLE IF NOT EXISTS counselling.institutes (
  id          SERIAL PRIMARY KEY,
  body        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  state       TEXT,
  home_states TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (body, name)
)`,
  `CREATE TABLE IF NOT EXISTS counselling.programs (
  id             SERIAL PRIMARY KEY,
  institute_id   INTEGER NOT NULL REFERENCES counselling.institutes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  degree         TEXT,
  duration_years SMALLINT,
  UNIQUE (institute_id, name)
)`,
  `CREATE TABLE IF NOT EXISTS counselling.cutoffs (
  dataset_id     INTEGER NOT NULL REFERENCES counselling.datasets(id) ON DELETE CASCADE,
  program_id     INTEGER NOT NULL REFERENCES counselling.programs(id) ON DELETE CASCADE,
  quota          TEXT NOT NULL,
  seat_type      TEXT NOT NULL,
  pwd            BOOLEAN NOT NULL,
  gender         TEXT NOT NULL CHECK (gender IN ('neutral', 'female')),
  rank_basis     TEXT NOT NULL CHECK (rank_basis IN ('jee_adv', 'jee_main', 'neet_air', 'state_rank')),
  opening_rank   INTEGER CHECK (opening_rank > 0),
  closing_rank   INTEGER NOT NULL CHECK (closing_rank > 0),
  opening_prep   BOOLEAN NOT NULL DEFAULT false,
  closing_prep   BOOLEAN NOT NULL DEFAULT false,
  seats          INTEGER CHECK (seats >= 0),
  precision_lost BOOLEAN NOT NULL DEFAULT false,
  derived        TEXT NOT NULL DEFAULT 'official' CHECK (derived IN ('official', 'from_allotments', 'joined_merit_list')),
  PRIMARY KEY (dataset_id, program_id, quota, seat_type, pwd, gender)
)`,
  `CREATE INDEX IF NOT EXISTS counselling_cutoffs_match_idx ON counselling.cutoffs (rank_basis, seat_type, pwd, gender, quota, closing_rank)`,
  `CREATE INDEX IF NOT EXISTS counselling_cutoffs_program_idx ON counselling.cutoffs (program_id)`,
  `CREATE INDEX IF NOT EXISTS counselling_programs_institute_idx ON counselling.programs (institute_id)`,
];

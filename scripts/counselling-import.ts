/**
 * Import the clean counselling CSVs into the `counselling` schema
 * (plan V1/PERCENTILE_PREDICTOR_PLAN.md §6.2, TEST_CASES T8).
 *
 *   npm run counselling:import -- --dir <folder> --all
 *   npm run counselling:import -- --dir <folder> --body josaa --year 2026 [--round 5] [--replace]
 *
 * Options
 *   --dir <folder>     the clean CSV folder (…/percentile-predictor/data/clean/counselling).
 *                      Default: $COUNSELLING_DATA_DIR, else ../percentile-predictor/data/clean/counselling.
 *                      The CSVs are NOT in git (69 MB); the script stops if the folder is missing.
 *   --all              every *.csv in the folder
 *   --body <b> --year <y> [--round <n>]   one body/year (optionally one round)
 *   --replace          rewrite datasets even when their content is unchanged
 *   --allow-partial    import the good rows of a file that has bad rows (else: stop, nothing written)
 *   --dry-run          validate and print counts; no database
 *   --i-know-this-is-prod  + CONFIRM_DESTRUCTIVE_DB_HOST=<host>: required for any non-local database
 *
 * Idempotent: each dataset (body × year × round) is replaced in one
 * transaction (delete its rows, insert the new ones). A dataset whose content
 * hash matches the stored one is skipped unless --replace, so a second run
 * changes nothing. --all is the whole truth: it also removes datasets that are
 * no longer in the CSVs and programs / institutes nothing uses any more.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import pg from "pg";

import { bodyFromFileName, parseCounsellingCsv } from "../src/lib/counselling/csv";
import { buildImportPlan, isoFromDmy, pickSource, type PlannedDataset, type SourceEntry } from "../src/lib/counselling/import-plan";
import { COUNSELLING_BODIES, type CounsellingBody, type CutoffRow } from "../src/lib/counselling/types";
import { COUNSELLING_MIGRATION_ID, COUNSELLING_MIGRATION_NAME, COUNSELLING_SCHEMA_DDL } from "../src/server/counselling/schema-ddl";
import { SCHEMA_DDL_LOCK_ID } from "../src/server/schema-lock";
import { checkDestructiveTarget, isLocalDatabaseHost, withoutGuardFlags } from "./lib/destructive-db-guard.mjs";

type Args = {
  dir: string;
  all: boolean;
  body: CounsellingBody | null;
  year: number | null;
  round: number | null;
  replace: boolean;
  allowPartial: boolean;
  dryRun: boolean;
};

function usage(message: string): never {
  console.error(`counselling:import: ${message}\nRun with --all, or --body <body> --year <yyyy> [--round <n>]. See the comment at the top of scripts/counselling-import.ts.`);
  process.exit(2);
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    dir: process.env.COUNSELLING_DATA_DIR || resolve(process.cwd(), "../percentile-predictor/data/clean/counselling"),
    all: false,
    body: null,
    year: null,
    round: null,
    replace: false,
    allowPartial: false,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) usage(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === "--dir") args.dir = resolve(next());
    else if (a === "--all") args.all = true;
    else if (a === "--body") {
      const b = next();
      if (!(COUNSELLING_BODIES as readonly string[]).includes(b)) usage(`unknown body "${b}" (one of ${COUNSELLING_BODIES.join(", ")})`);
      args.body = b as CounsellingBody;
    } else if (a === "--year") {
      const y = next();
      if (!/^\d{4}$/u.test(y)) usage(`bad year "${y}"`);
      args.year = Number(y);
    } else if (a === "--round") {
      const r = next();
      if (!/^\d{1,2}$/u.test(r)) usage(`bad round "${r}"`);
      args.round = Number(r);
    } else if (a === "--replace") args.replace = true;
    else if (a === "--allow-partial") args.allowPartial = true;
    else if (a === "--dry-run") args.dryRun = true;
    else usage(`unknown option "${a}"`);
  }
  if (!args.all && (!args.body || !args.year)) usage("say which data: --all, or --body and --year");
  if (args.all && (args.body || args.year || args.round !== null)) usage("--all cannot be combined with --body/--year/--round");
  return args;
}


function loadSources(dir: string): Record<string, SourceEntry[]> {
  const file = join(dir, "sources.json");
  if (!existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, "utf8")) as { files?: Record<string, SourceEntry[]> };
  return parsed.files ?? {};
}

function filesToRead(args: Args): string[] {
  const all = readdirSync(args.dir).filter((f) => f.endsWith(".csv")).sort();
  if (args.all) return all;
  return all.filter((f) => {
    const fromName = bodyFromFileName(f);
    if (fromName) return fromName.body === args.body && fromName.year === args.year;
    // csab-YYYY.csv holds csab_special and csab_neut.
    return f === `csab-${args.year}.csv` && (args.body === "csab_special" || args.body === "csab_neut");
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(withoutGuardFlags(argv));

  if (!existsSync(args.dir) || !statSync(args.dir).isDirectory()) {
    console.error(
      `counselling:import: data folder not found: ${args.dir}\n` +
        "The clean counselling CSVs are not in git. Pass --dir <folder> (or set COUNSELLING_DATA_DIR) pointing at\n" +
        "V1/percentile-predictor/data/clean/counselling on the machine that has them.",
    );
    process.exit(1);
  }
  const files = filesToRead(args);
  if (!files.length) usage(`no matching CSV in ${args.dir}`);
  const sources = loadSources(args.dir);

  // 1. Read and validate everything first: nothing is written if a file is bad (T8.2).
  const rows: CutoffRow[] = [];
  const fileOf = new Map<string, string>();
  let anyRejected = false;
  const fileReport: { file: string; read: number; rejected: number }[] = [];
  for (const file of files) {
    const fromName = bodyFromFileName(file);
    const parsed = parseCounsellingCsv(readFileSync(join(args.dir, file), "utf8"), fromName?.body);
    let picked = parsed.rows;
    if (!args.all) picked = picked.filter((r) => r.body === args.body && r.year === args.year && (args.round === null || r.round === args.round));
    fileReport.push({ file, read: parsed.rows.length + parsed.rejected.length, rejected: parsed.rejected.length });
    if (parsed.rejected.length) {
      anyRejected = true;
      console.error(`\n${file}: ${parsed.rejected.length} bad row(s)`);
      for (const r of parsed.rejected.slice(0, 15)) console.error(`  line ${r.line}: ${r.error}`);
      if (parsed.rejected.length > 15) console.error(`  … and ${parsed.rejected.length - 15} more`);
    }
    for (const r of picked) fileOf.set(`${r.body}|${r.year}|${r.round}`, file);
    rows.push(...picked);
  }
  if (anyRejected && !args.allowPartial) {
    console.error("\nStopped: bad rows found, nothing was written. Fix the clean CSV, or re-run with --allow-partial to import only the good rows.");
    process.exit(1);
  }
  if (!rows.length) usage("no rows matched");

  const plan = buildImportPlan(rows);
  console.log(
    `Planned: ${plan.datasets.length} datasets, ${plan.institutes.length} institutes, ${plan.programs.length} programs` +
      ` (${plan.mergedNameVariants} cells merged from name variants, ${plan.droppedDuplicates} duplicate rows dropped).`,
  );
  if (args.dryRun) {
    for (const ds of plan.datasets) console.log(`  ${ds.body} ${ds.year} round ${ds.round}${ds.isFinal ? " (final)" : ""}: ${ds.cells.length} rows`);
    printFileTotals(plan.datasets, fileOf, fileReport);
    return;
  }

  // 2. Database (local only unless explicitly confirmed).
  const connectionString = process.env.USER_DATABASE_URL;
  if (!connectionString) usage("USER_DATABASE_URL is not set (run through npm run counselling:import, which loads .env.local)");
  const guard = checkDestructiveTarget({ connectionString, argv, env: process.env, action: "counselling:import" });
  if (!guard.allowed) {
    console.error(guard.reason);
    process.exit(1);
  }
  if (!guard.local) console.warn(guard.reason);
  const client = new pg.Client({ connectionString, ssl: isLocalDatabaseHost(guard.host) || guard.host?.startsWith("/") ? false : true });
  await client.connect();
  try {
    await ensureSchema(client);
    const instituteIds = await upsertInstitutes(client, plan, args.all);
    const programIds = await upsertPrograms(client, plan, instituteIds);

    const existing = await client.query<{
      body: string;
      year: number;
      round: number;
      sha256: string;
      id: number;
      source_url: string | null;
      publisher: string | null;
      official: boolean;
      fetched_on: string | null;
    }>("SELECT id, body, year, round, sha256, source_url, publisher, official, fetched_on::text AS fetched_on FROM counselling.datasets");
    const known = new Map(existing.rows.map((r) => [`${r.body}|${r.year}|${r.round}`, r]));
    let written = 0;
    let unchanged = 0;
    let resourced = 0;
    for (const ds of plan.datasets) {
      const key = `${ds.body}|${ds.year}|${ds.round}`;
      const prev = known.get(key);
      const src = pickSource(sources[fileOf.get(key) ?? ""] ?? [], ds.round);
      if (prev && prev.sha256 === ds.sha256 && !args.replace) {
        unchanged += 1;
        // Same seat rows, but the source on record may have been corrected in sources.json:
        // update the four source fields only (no seat row is touched).
        const next = { url: src.url ?? null, publisher: src.publisher ?? null, official: src.official ?? true, fetchedOn: isoFromDmy(src.fetchedOn) };
        if (prev.source_url !== next.url || prev.publisher !== next.publisher || prev.official !== next.official || (prev.fetched_on ?? null) !== (next.fetchedOn ?? null)) {
          await client.query("UPDATE counselling.datasets SET source_url = $2, publisher = $3, official = $4, fetched_on = $5 WHERE id = $1", [
            prev.id,
            next.url,
            next.publisher,
            next.official,
            next.fetchedOn,
          ]);
          resourced += 1;
          console.log(`  source corrected: ${ds.body} ${ds.year} round ${ds.round}`);
        }
        continue;
      }
      await writeDataset(client, ds, src, programIds);
      written += 1;
    }
    let pruned = 0;
    if (args.all) {
      // A full run is the whole truth: datasets no longer in the CSVs (a round removed or renumbered) go,
      // then programs / institutes nothing points at any more.
      const planned = new Set(plan.datasets.map((d) => `${d.body}|${d.year}|${d.round}`));
      const stale = existing.rows.filter((r) => !planned.has(`${r.body}|${r.year}|${r.round}`));
      for (const r of stale) console.log(`  removing stale dataset ${r.body} ${r.year} round ${r.round}`);
      if (stale.length) await client.query("DELETE FROM counselling.datasets WHERE id = ANY($1::int[])", [stale.map((r) => r.id)]);
      pruned = stale.length;
      const orphans = await client.query(
        `WITH p AS (
           DELETE FROM counselling.programs p WHERE NOT EXISTS (SELECT 1 FROM counselling.cutoffs c WHERE c.program_id = p.id) RETURNING 1
         )
         SELECT count(*)::int AS n FROM p`,
      );
      const orphanInstitutes = await client.query(
        `WITH i AS (
           DELETE FROM counselling.institutes i WHERE NOT EXISTS (SELECT 1 FROM counselling.programs p WHERE p.institute_id = i.id) RETURNING 1
         )
         SELECT count(*)::int AS n FROM i`,
      );
      if (orphans.rows[0].n || orphanInstitutes.rows[0].n) console.log(`  removed ${orphans.rows[0].n} unused programs, ${orphanInstitutes.rows[0].n} unused institutes`);
    }
    console.log(`\nDatasets written: ${written}, unchanged (skipped): ${unchanged}, of those with the source corrected: ${resourced}, removed (no longer in the CSVs): ${pruned}.`);
    const counts = await client.query<{ body: string; year: number; n: string }>(
      `SELECT d.body, d.year, count(c.*)::text AS n
         FROM counselling.datasets d LEFT JOIN counselling.cutoffs c ON c.dataset_id = d.id
        GROUP BY d.body, d.year ORDER BY d.body, d.year`,
    );
    console.log("\nRows now in the database (body, year, cut-off rows):");
    for (const r of counts.rows) console.log(`  ${r.body.padEnd(13)} ${r.year}  ${Number(r.n).toLocaleString("en-IN")}`);
    printFileTotals(plan.datasets, fileOf, fileReport);
  } finally {
    await client.end();
  }
}

function printFileTotals(datasets: PlannedDataset[], fileOf: Map<string, string>, report: { file: string; read: number; rejected: number }[]) {
  const imported = new Map<string, number>();
  for (const ds of datasets) {
    const f = fileOf.get(`${ds.body}|${ds.year}|${ds.round}`) ?? "?";
    imported.set(f, (imported.get(f) ?? 0) + ds.cells.length);
  }
  console.log("\nPer file: CSV rows read / rejected / seat cells imported");
  for (const r of report) console.log(`  ${r.file.padEnd(20)} ${String(r.read).padStart(7)} ${String(r.rejected).padStart(5)} ${String(imported.get(r.file) ?? 0).padStart(7)}`);
}

async function ensureSchema(client: pg.Client) {
  await client.query("BEGIN");
  try {
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
    for (const statement of COUNSELLING_SCHEMA_DDL) await client.query(statement);
    await client.query(
      "CREATE SCHEMA IF NOT EXISTS app; CREATE TABLE IF NOT EXISTS app.migrations (id TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    );
    await client.query("INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", [COUNSELLING_MIGRATION_ID, COUNSELLING_MIGRATION_NAME]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

const INSTITUTE_UPDATE = `ON CONFLICT (body, name) DO UPDATE
        SET type = EXCLUDED.type, state = EXCLUDED.state, home_states = EXCLUDED.home_states
      WHERE (counselling.institutes.type, counselling.institutes.state, counselling.institutes.home_states)
            IS DISTINCT FROM (EXCLUDED.type, EXCLUDED.state, EXCLUDED.home_states)`;

/**
 * Type / state / home states are worked out from all the rows of the run
 * (MCC type depends on every quota a college had). Only a full run (--all)
 * may change an existing institute; a one-body / one-year run only adds new
 * ones, so it cannot overwrite what the other years established.
 */
async function upsertInstitutes(client: pg.Client, plan: ReturnType<typeof buildImportPlan>, full: boolean): Promise<Map<string, number>> {
  const list = plan.institutes;
  await client.query(
    `INSERT INTO counselling.institutes (body, name, type, state, home_states)
     SELECT b, n, t, s, COALESCE(string_to_array(h, '|'), '{}')
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[]) AS x(b, n, t, s, h)
     ${full ? INSTITUTE_UPDATE : "ON CONFLICT (body, name) DO NOTHING"}`,
    [list.map((i) => i.group), list.map((i) => i.name), list.map((i) => i.type), list.map((i) => i.state), list.map((i) => (i.homeStates.length ? i.homeStates.join("|") : null))],
  );
  const res = await client.query<{ id: number; body: string; name: string }>("SELECT id, body, name FROM counselling.institutes");
  return new Map(res.rows.map((r) => [`${r.body}\u0000${r.name}`, r.id]));
}

async function upsertPrograms(client: pg.Client, plan: ReturnType<typeof buildImportPlan>, instituteIds: Map<string, number>): Promise<Map<string, number>> {
  const list = plan.programs;
  const ids = list.map((p) => {
    const id = instituteIds.get(p.instituteKey);
    if (id === undefined) throw new Error(`institute missing after upsert: ${p.instituteKey}`);
    return id;
  });
  await client.query(
    `INSERT INTO counselling.programs (institute_id, name, degree, duration_years)
     SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::smallint[])
     ON CONFLICT (institute_id, name) DO UPDATE
        SET degree = EXCLUDED.degree, duration_years = EXCLUDED.duration_years
      WHERE (counselling.programs.degree, counselling.programs.duration_years)
            IS DISTINCT FROM (EXCLUDED.degree, EXCLUDED.duration_years)`,
    [ids, list.map((p) => p.name), list.map((p) => p.degree), list.map((p) => p.durationYears)],
  );
  const res = await client.query<{ id: number; institute_id: number; name: string }>("SELECT id, institute_id, name FROM counselling.programs");
  const byInstitute = new Map([...instituteIds.entries()].map(([k, v]) => [v, k]));
  return new Map(res.rows.map((r) => [`${byInstitute.get(r.institute_id)}\u0000${r.name}`, r.id]));
}

async function writeDataset(client: pg.Client, ds: PlannedDataset, src: SourceEntry, programIds: Map<string, number>) {
  await client.query("BEGIN");
  try {
    const res = await client.query<{ id: number }>(
      `INSERT INTO counselling.datasets (body, year, round, round_label, is_final, source_url, publisher, official, fetched_on, row_count, sha256, imported_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       ON CONFLICT (body, year, round) DO UPDATE SET
         round_label = EXCLUDED.round_label, is_final = EXCLUDED.is_final, source_url = EXCLUDED.source_url,
         publisher = EXCLUDED.publisher, official = EXCLUDED.official, fetched_on = EXCLUDED.fetched_on,
         row_count = EXCLUDED.row_count, sha256 = EXCLUDED.sha256, imported_at = now()
       RETURNING id`,
      [ds.body, ds.year, ds.round, ds.roundLabel, ds.isFinal, src.url ?? null, src.publisher ?? null, src.official ?? true, isoFromDmy(src.fetchedOn), ds.cells.length, ds.sha256],
    );
    const datasetId = res.rows[0].id;
    await client.query("DELETE FROM counselling.cutoffs WHERE dataset_id = $1", [datasetId]);
    const CHUNK = 5000;
    for (let i = 0; i < ds.cells.length; i += CHUNK) {
      const part = ds.cells.slice(i, i + CHUNK);
      const programId = part.map((c) => {
        const id = programIds.get(`${c.instituteKey}\u0000${c.program}`);
        if (id === undefined) throw new Error(`program missing: ${c.program}`);
        return id;
      });
      await client.query(
        `INSERT INTO counselling.cutoffs (dataset_id, program_id, quota, seat_type, pwd, gender, rank_basis, opening_rank, closing_rank,
                                          opening_prep, closing_prep, seats, precision_lost, derived)
         SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[], $5::bool[], $6::text[], $7::text[], $8::int[], $9::int[],
                                  $10::bool[], $11::bool[], $12::int[], $13::bool[], $14::text[])`,
        [
          datasetId,
          programId,
          part.map((c) => c.quota),
          part.map((c) => c.seatType),
          part.map((c) => c.pwd),
          part.map((c) => c.gender),
          part.map((c) => c.rankBasis),
          part.map((c) => c.openingRank),
          part.map((c) => c.closingRank),
          part.map((c) => c.openingPrep),
          part.map((c) => c.closingPrep),
          part.map((c) => c.seats),
          part.map((c) => c.precisionLost),
          part.map((c) => c.derived),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Applies pending SQL migrations at BUILD time (the `prebuild` npm hook), so a
 * Vercel deploy brings its own schema with it instead of relying on a human
 * remembering to run psql against Neon first.
 *
 * Design notes
 * ------------
 * • EXPLICIT ALLOWLIST, not directory auto-discovery. `src/db/migrations/`
 *   holds ~60 historical files (plus their `.rollback.sql` siblings). Most were
 *   applied by hand long ago and not all are safe to re-run. Auto-running the
 *   directory would be a production incident waiting to happen. Every new drop
 *   adds its own entries here deliberately.
 *
 * • A `schema_migrations` ledger records what has run, so a re-deploy is a
 *   no-op rather than a re-execution. The migrations are idempotent anyway
 *   (`IF NOT EXISTS`, guarded `DO $$` blocks) — the ledger is for auditability
 *   and to keep deploys fast.
 *
 * • Each file is sent to Postgres as ONE query string. `pg` runs a multi-
 *   statement simple query inside an implicit transaction, so a file either
 *   fully applies or not at all. This also means the file must NOT be split on
 *   `;` — the `DO $$ ... END $$;` blocks contain their own semicolons.
 *
 * • Failure policy: if the target database is configured, a migration error
 *   FAILS THE BUILD. Deploying code against missing schema is worse than not
 *   deploying. In production a MISSING database URL is also fatal, because
 *   silently skipping would look like success while leaving prod un-migrated.
 *   Outside production a missing URL just skips (local builds, previews with no
 *   database attached).
 *
 * • Safety net, not a replacement for it: `ensureUserSchema` (db-users.ts) and
 *   `ensureCatalogSchema` (ogcode-catalog.ts) still mirror these statements at
 *   runtime, so an un-migrated database self-heals on first request.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md §9.1.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "src", "db", "migrations");

/**
 * Migrations to auto-apply, in order. `target` picks the connection string:
 *   user   -> USER_DATABASE_URL    (origin_users, entitlements, rooms, …)
 *   ogcode -> OGCODE_DATABASE_URL  (ogcode_questions, analytics, …)
 *
 * In production both currently point at the same physical Neon cluster; they
 * are separate pools in code, so the target is still declared explicitly.
 *
 * Append new entries at the END. Never remove or reorder applied ones.
 */
const MIGRATIONS = [
  // Study Mode (JEE / NEET / PCMB) — 2026-08-01.
  { file: "20260801_user_study_mode.sql", target: "user" },
  { file: "20260801_ogcode_daily_challenge_mode.sql", target: "ogcode" },
  // CBT attempt resilience (offline resume + finalize reasons) — 2026-08-02.
  { file: "20260802_cbt_attempt_resilience.sql", target: "user" },
  // CBT sectional marking + shareable report cards — 2026-08-04.
  { file: "20260804_cbt_report_cards.sql", target: "user" },
  // Teacher test → batch DPP shares — 2026-08-08. The USER-side share tables
  // and the OGCODE-side analytics.dpp_plans columns are two different physical
  // targets, hence two entries. Order matters only in that a teacher cannot
  // share before the first exists; both are additive and idempotent.
  { file: "20260808_teacher_dpp_shares.sql", target: "user" },
  { file: "20260808_dpp_plans_teacher_origin.sql", target: "ogcode" },
  // Teacher DPP scoring + batch leaderboards — 2026-08-08. Marks snapshot on
  // the share (user) + scored, batch-stamped attempts (ogcode).
  { file: "20260808_teacher_dpp_scoring.sql", target: "user" },
  { file: "20260808_dpp_attempt_scoring.sql", target: "ogcode" },
  // Per-question DPP results — 2026-08-08. A DPP has no submit button, so
  // progress must be durable per checked answer rather than at submit.
  { file: "20260808_dpp_question_results.sql", target: "ogcode" },
  // CBT participation quota — 2026-08-08. Admin-set caps per CBT teacher, the
  // append-only participation meter, and the request/approval ledger.
  { file: "20260808_cbt_participation_quota.sql", target: "user" },
];

const TARGET_ENV = {
  user: "USER_DATABASE_URL",
  ogcode: "OGCODE_DATABASE_URL",
};

const LEDGER_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

function log(message) {
  console.log(`[migrations] ${message}`);
}

/** Neon requires TLS; `pg` needs it stated explicitly for a plain URL. */
function poolFor(connectionString) {
  return new pg.Pool({
    connectionString,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? false : { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 15_000,
  });
}

async function applyForTarget(target, migrations) {
  const envName = TARGET_ENV[target];
  const connectionString = process.env[envName];

  if (!connectionString) {
    if (isProduction) {
      throw new Error(
        `${envName} is not available at build time, so ${migrations.length} migration(s) for the ` +
          `"${target}" database cannot be applied. Expose ${envName} to the Build environment in ` +
          `Vercel (Project → Settings → Environment Variables → check "Build"), then redeploy.`,
      );
    }
    log(`${envName} not set — skipping ${migrations.length} "${target}" migration(s).`);
    return;
  }

  const pool = poolFor(connectionString);
  try {
    await pool.query(LEDGER_SQL);
    const { rows } = await pool.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.filename));

    for (const { file } of migrations) {
      if (applied.has(file)) {
        log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      log(`apply ${file} → ${target}`);
      // One query string = one implicit transaction. Do not split on ';' —
      // the DO $$ ... END $$; blocks contain their own.
      await pool.query(sql);
      await pool.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
        [file],
      );
      log(`done  ${file}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
}

async function main() {
  if (process.env.SKIP_DB_MIGRATIONS === "1") {
    log("SKIP_DB_MIGRATIONS=1 — skipping all migrations.");
    return;
  }
  if (MIGRATIONS.length === 0) {
    log("nothing to apply.");
    return;
  }

  const byTarget = new Map();
  for (const migration of MIGRATIONS) {
    if (!TARGET_ENV[migration.target]) {
      throw new Error(`Unknown migration target "${migration.target}" for ${migration.file}.`);
    }
    if (!byTarget.has(migration.target)) byTarget.set(migration.target, []);
    byTarget.get(migration.target).push(migration);
  }

  for (const [target, migrations] of byTarget) {
    await applyForTarget(target, migrations);
  }
  log("up to date.");
}

main().catch((error) => {
  console.error("[migrations] FAILED —", error?.message ?? error);
  console.error(
    "[migrations] The build is being failed on purpose: shipping code against missing schema is " +
      "worse than not shipping. Fix the database/env issue and redeploy, or set " +
      "SKIP_DB_MIGRATIONS=1 to deploy without applying (the runtime schema-ensure blocks will " +
      "then apply the changes lazily on first request).",
  );
  process.exit(1);
});

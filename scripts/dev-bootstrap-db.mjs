/**
 * DEV ONLY — bring a fresh local Postgres up to the full schema set.
 *
 * WHY THIS EXISTS. `run-migrations.mjs` is a deliberate ALLOWLIST that starts at
 * 2026-08-01; the ~60 migrations before that were applied by hand against
 * production long ago and are in no list. A newly created local database
 * therefore never receives them, and the allowlist migrations then fail on
 * schemas that do not exist ("schema \"cbt\" does not exist"). Nothing in the
 * repo closed that gap, so every new machine hit it.
 *
 * Three things this handles that a naive loop does not:
 *
 *  1. ROLLBACK after every failure. A failed multi-statement query leaves the
 *     session in an aborted transaction (25P02) and every later migration then
 *     fails for that reason alone rather than on its own merits.
 *  2. Schemas are pre-created. Some migrations assume a schema an earlier
 *     hand-run created — `rooms` and `cbt` have no CREATE SCHEMA anywhere in
 *     this repo.
 *  3. Two passes. The migrations are idempotent, so a second pass clears
 *     failures caused purely by ordering.
 *
 * Refuses to run against anything but localhost.
 *
 *   npm run db:bootstrap
 *
 * Afterwards: `npm run db:migrate`, then `npm run ogcode:import:replace`
 * (without it /ogcode renders an empty library).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "src", "db", "migrations");

/** Every schema any migration or runtime-ensure block expects to exist. */
const SCHEMAS = [
  "analytics", "app", "assessment", "cbt", "commerce", "content", "contest",
  "entitlements", "import", "odg", "origin_ai", "payments", "pricing", "rooms",
  "social", "subscriptions",
];

/** Known-permanent failures — reported, not alarming. */
const EXPECTED_FAILURES = {
  "20260525_remove_demo_seeds.sql":
    "cleans up a legacy app.origin_users table that no longer exists",
  "20260801_ogcode_daily_challenge_mode.sql":
    "alters ogcode_daily_challenges, created by the OGCode import, not by any migration — run npm run ogcode:import:replace",
};

const log = (msg) => console.log(`[bootstrap] ${msg}`);

const url = process.env.USER_DATABASE_URL;
if (!url) {
  console.error("[bootstrap] USER_DATABASE_URL not set. Run via `npm run db:bootstrap` so .env.local is loaded.");
  process.exit(1);
}
if (!/(localhost|127\.0\.0\.1)/.test(url)) {
  console.error(`[bootstrap] REFUSING — local databases only. Got: ${url.replace(/:[^:@]*@/, ":***@")}`);
  console.error("[bootstrap] Production already has these applied by hand; re-running them there is exactly the incident the allowlist guards against.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const q = async (sql) => {
  try { await client.query(sql); return null; }
  catch (e) { await client.query("ROLLBACK").catch(() => {}); return e.message.split("\n")[0]; }
};
const schemas = async () =>
  (await client.query(
    `select schema_name from information_schema.schemata
      where schema_name not like 'pg_%' and schema_name <> 'information_schema' order by 1`,
  )).rows.map((r) => r.schema_name);

const before = await schemas();
log(`schemas before: ${before.join(", ")}`);

log("pre-creating schemas…");
for (const s of SCHEMAS) {
  const err = await q(`CREATE SCHEMA IF NOT EXISTS ${s}`);
  if (err) log(`  ! ${s}: ${err}`);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".sql") && !f.endsWith(".rollback.sql")).sort();
log(`${files.length} migrations found`);

let pending = files;
let applied = 0;
for (let pass = 1; pass <= 2 && pending.length; pass++) {
  log(`── pass ${pass} (${pending.length} to try) ──`);
  const still = [];
  for (const f of pending) {
    const err = await q(readFileSync(path.join(DIR, f), "utf8"));
    if (err) { still.push([f, err]); if (pass === 2) log(`  SKIP  ${f}  —  ${err}`); }
    else { applied++; log(`  ok    ${f}${pass === 2 ? "  (pass 2)" : ""}`); }
  }
  pending = still.map(([f]) => f);
  if (pass === 1) log(`pass 1: ${applied} applied, ${pending.length} to retry`);
  if (pass === 2) pending = still;
}

const after = await schemas();
const gained = after.filter((s) => !before.includes(s));
log("");
log(`applied ${applied}/${files.length}`);
log(`schemas after : ${after.join(", ")}`);
log(`schemas gained: ${gained.length ? gained.join(", ") : "(none)"}`);

const unexpected = (pending ?? []).filter(([f]) => !EXPECTED_FAILURES[f]);
const expected = (pending ?? []).filter(([f]) => EXPECTED_FAILURES[f]);
if (expected.length) {
  log("");
  log("expected failures (safe to ignore):");
  for (const [f] of expected) log(`  ${f} — ${EXPECTED_FAILURES[f]}`);
}
if (unexpected.length) {
  log("");
  log(`⚠  ${unexpected.length} UNEXPECTED failure(s):`);
  for (const [f, err] of unexpected) log(`  ${f}\n      ${err}`);
}

const key = await client.query(`select
  to_regclass('analytics.dpp_attempts') dpp_attempts,
  to_regclass('analytics.dpp_plans')    dpp_plans,
  to_regclass('contest.contests')       contests,
  to_regclass('rooms.rooms')            rooms,
  to_regclass('payments.orders')        orders`);
log("");
log(`key tables: ${JSON.stringify(key.rows[0])}`);
log("");
log("next: npm run db:migrate   then   npm run ogcode:import:replace");
await client.end();
process.exit(unexpected.length ? 1 : 0);

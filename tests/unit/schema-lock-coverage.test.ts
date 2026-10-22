/**
 * Every runtime schema-ensure must take the ONE shared DDL advisory lock
 * (src/server/schema-lock.ts). A module that runs CREATE/ALTER without it
 * re-opens the cold-start races the lock exists for: concurrent
 * `CREATE TABLE IF NOT EXISTS` colliding on pg_type, and the 40P01 deadlock
 * between ensures that share FK targets such as origin_users.
 *
 * This walks src/ for files that carry DDL in code (comments are ignored) and
 * fails for any that never reference the lock. A new ensure module that trips
 * it should wrap its DDL in `withSchemaLock(pool, …)`, or call
 * `lockSchemaDdl(client)` right after its own BEGIN.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool, PoolClient } from "pg";

import { SCHEMA_DDL_LOCK_ID, SCHEMA_DDL_LOCK_SQL, withSchemaLock } from "@/server/schema-lock";

const SRC = fileURLToPath(new URL("../../src", import.meta.url));

/**
 * Files allowed to run DDL without the lock, with the reason. Keep this short.
 */
const ALLOWLIST: Record<string, string> = {
  // Defines the lock itself.
  "server/schema-lock.ts": "lock definition",
  // CREATE INDEX CONCURRENTLY / VALIDATE CONSTRAINT cannot run inside a
  // transaction block, and a session-level advisory lock is unsafe on the Neon
  // PgBouncer pooler (see schema-lock.ts). It is an online, idempotent backfill.
  "server/cbt/cbt-backfill.ts": "CONCURRENTLY index build, no transaction possible",
};

const DDL = /\b(?:CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX|SCHEMA|EXTENSION|TYPE)|ALTER\s+(?:TABLE|TYPE))\b/;
const USES_LOCK = /\b(?:withSchemaLock|lockSchemaDdl)\(|\bSCHEMA_DDL_LOCK_ID\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/** Drop block comments and whole-line `//` / ` * ` comments; SQL `--` lines stay (they sit inside strings). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

test("every src module that runs DDL takes the shared schema lock", () => {
  const offenders: string[] = [];
  const ddlFiles: string[] = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join("/");
    const code = stripComments(readFileSync(file, "utf8"));
    if (!DDL.test(code)) continue;
    ddlFiles.push(rel);
    if (ALLOWLIST[rel]) continue;
    if (!USES_LOCK.test(code)) offenders.push(rel);
  }
  // Guard against the walker silently finding nothing (wrong SRC path).
  assert.ok(ddlFiles.length > 20, `expected many DDL modules, found ${ddlFiles.length}`);
  assert.deepEqual(offenders, [], `DDL without the shared schema lock:\n  ${offenders.join("\n  ")}`);
});

test("allowlisted files still exist and still carry DDL", () => {
  for (const rel of Object.keys(ALLOWLIST)) {
    const code = stripComments(readFileSync(path.join(SRC, rel), "utf8"));
    assert.ok(DDL.test(code) || rel === "server/schema-lock.ts", `${rel} no longer needs an allowlist entry`);
  }
});

type Call = string;

function fakeClient(calls: Call[], failOn?: string) {
  return {
    async query(text: string, values?: unknown[]) {
      calls.push(values ? `${text} ${JSON.stringify(values)}` : text);
      if (failOn && text.includes(failOn)) throw new Error(`boom: ${failOn}`);
      return { rows: [] };
    },
    release() {
      calls.push("release");
    },
  };
}

test("withSchemaLock(pool) wraps fn in BEGIN + lock + COMMIT and releases the client", async () => {
  const calls: Call[] = [];
  const client = fakeClient(calls);
  const pool = { connect: async () => client } as unknown as Pool;
  const result = await withSchemaLock(pool, async (c) => {
    await c.query("CREATE TABLE IF NOT EXISTS t (id int)");
    return 7;
  });
  assert.equal(result, 7);
  assert.deepEqual(calls, [
    "BEGIN",
    `${SCHEMA_DDL_LOCK_SQL} ${JSON.stringify([SCHEMA_DDL_LOCK_ID])}`,
    "CREATE TABLE IF NOT EXISTS t (id int)",
    "COMMIT",
    "release",
  ]);
});

test("withSchemaLock rolls back, releases and rethrows when fn fails", async () => {
  const calls: Call[] = [];
  const client = fakeClient(calls, "ALTER");
  const pool = { connect: async () => client } as unknown as Pool;
  await assert.rejects(
    withSchemaLock(pool, (c) => c.query("ALTER TABLE t ADD COLUMN x int")),
    /boom: ALTER/,
  );
  assert.deepEqual(calls.slice(-2), ["ROLLBACK", "release"]);
  assert.ok(!calls.includes("COMMIT"));
});

test("withSchemaLock(client) runs its own transaction but leaves the client checked out", async () => {
  const calls: Call[] = [];
  const client = fakeClient(calls) as unknown as PoolClient;
  await withSchemaLock(client, (c) => c.query("CREATE SCHEMA IF NOT EXISTS x"));
  assert.equal(calls[0], "BEGIN");
  assert.equal(calls.at(-1), "COMMIT");
  assert.ok(!calls.includes("release"));
});

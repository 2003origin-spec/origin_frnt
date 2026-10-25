/**
 * Bug-hunt 10 / N3 guard rails.
 *
 * 1. No code in src/ may use the legacy whole-store rewrite `withStoreAsync`
 *    (it DELETEs and re-inserts every app.* table from one instance's snapshot,
 *    erasing other instances' concurrent writes). New handlers must use
 *    withStoreAsyncScoped with the collections they mutate, or readStoreAsync.
 * 2. withStoreAsync itself throws in hosted production when user Postgres is
 *    configured, so a caller that slips past (1) fails loudly instead of
 *    silently wiping data.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { installFakeUserPool } from "./_scoped-store-fakes";
import { withStoreAsync, WholeStoreRewriteForbiddenError } from "../../src/server/store";

const SRC = path.resolve(__dirname, "../../src");

/**
 * Files allowed to mention withStoreAsync in CODE (comments never count). Only
 * the definition. Adding an entry here re-opens N3 — don't, use
 * withStoreAsyncScoped.
 */
const ALLOWLIST = new Set(["legacy/store.ts"]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Strips block and line comments (good enough for an identifier scan). */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

test("no src/ code calls or imports withStoreAsync (whole-store rewrite) outside the allowlist", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const relative = path.relative(SRC, file).split(path.sep).join("/");
    if (ALLOWLIST.has(relative)) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    code.split("\n").forEach((line, index) => {
      if (/\bwithStoreAsync\b(?!Scoped)/.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], `use withStoreAsyncScoped / readStoreAsync instead:\n${offenders.join("\n")}`);
});

test("the scan itself catches a call, a generic call and an import", () => {
  const hits = ["await withStoreAsync(async (s) => s)", "withStoreAsync<number>(fn)", "import { withStoreAsync } from 'x'"];
  for (const line of hits) assert.match(stripComments(line), /\bwithStoreAsync\b(?!Scoped)/);
  assert.doesNotMatch(stripComments("// the old withStoreAsync( rewrote everything"), /\bwithStoreAsync\b(?!Scoped)/);
  assert.doesNotMatch(stripComments("withStoreAsyncScoped(fn, null)"), /\bwithStoreAsync\b(?!Scoped)/);
});

function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("withStoreAsync throws in hosted production with Postgres configured, before any SQL", async () => {
  const sql = installFakeUserPool();
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await withEnv({ VERCEL_ENV: "production" }, async () => {
      let mutated = false;
      await assert.rejects(
        withStoreAsync(() => {
          mutated = true;
        }),
        WholeStoreRewriteForbiddenError,
      );
      assert.equal(mutated, false, "mutate never ran");
      assert.deepEqual(sql, [], "no hydrate, no DELETE");
    });
    await withEnv({ VERCEL_ENV: undefined, ORIGIN_DEPLOYMENT_ENV: "production" }, async () => {
      await assert.rejects(withStoreAsync(() => undefined), WholeStoreRewriteForbiddenError);
    });
  } finally {
    console.error = originalError;
  }
});

test("withStoreAsync still runs without user Postgres (dev/seed store) even when hosted", async () => {
  await withEnv({ USER_DATABASE_URL: undefined, VERCEL_ENV: "production" }, async () => {
    const result = await withStoreAsync((store) => store.users.length >= 0);
    assert.equal(result, true);
  });
});

test("withStoreAsync outside hosted production logs a metric line and still runs", async () => {
  installFakeUserPool();
  const logged: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    await withEnv(
      { VERCEL_ENV: undefined, RENDER_SERVICE_ID: undefined, RAILWAY_ENVIRONMENT: undefined, FLY_APP_NAME: undefined, ORIGIN_DEPLOYMENT_ENV: undefined },
      async () => {
        assert.equal(await withStoreAsync(() => 42), 42);
      },
    );
  } finally {
    console.error = originalError;
  }
  assert.ok(
    logged.some((args) => JSON.stringify(args).includes("store.whole_rewrite")),
    "emits the store.whole_rewrite metric line",
  );
});

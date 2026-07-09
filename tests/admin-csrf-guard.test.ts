import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for the "Invalid CSRF token" class of bugs.
 *
 * The middleware enforces a double-submit CSRF check on every mutating /api/*
 * request (cookie `origin_csrf` must equal header `x-csrf-token`). Admin panels
 * that fire a mutating `fetch()` without attaching the token get a 403
 * "Invalid CSRF token." before the route handler ever runs — exactly the bug
 * that hit AdminAdminsPanel / AdminCouponsPanel / AdminPricingPanel.
 *
 * The fix is to route mutations through a CSRF-aware wrapper (`mutateJson`,
 * `apiJson`, or spread `csrfHeaders()`), none of which contain a bare
 * `fetch(` call. This test fails if any admin component makes a raw mutating
 * `fetch(` whose call site does not attach the CSRF token — catching a
 * reintroduction the moment it lands, instead of in production.
 */

const ADMIN_DIR = join(__dirname, "..", "src", "components", "admin");
// `\bfetch(` deliberately excludes `refetch(` / `prefetch(` (no word boundary).
const RAW_FETCH = /\bfetch\(/g;
const MUTATING_METHOD = /method:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i;
const ATTACHES_CSRF = /x-csrf-token|csrfHeaders|mutateJson|apiJson/i;
// How far after a `fetch(` to look for the method + token evidence.
const WINDOW = 500;

test("admin components never fire a mutating fetch() without a CSRF token", () => {
  const files = readdirSync(ADMIN_DIR).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  const violations: string[] = [];

  for (const file of files) {
    const source = readFileSync(join(ADMIN_DIR, file), "utf8");
    for (const match of source.matchAll(RAW_FETCH)) {
      const start = match.index ?? 0;
      const window = source.slice(start, start + WINDOW);
      if (MUTATING_METHOD.test(window) && !ATTACHES_CSRF.test(window)) {
        const line = source.slice(0, start).split("\n").length;
        violations.push(`${file}:${line} — raw mutating fetch() without x-csrf-token (use mutateJson/apiJson/csrfHeaders)`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Admin panels must attach the CSRF token on mutations:\n${violations.join("\n")}`,
  );
});

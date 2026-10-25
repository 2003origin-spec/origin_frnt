/**
 * Shared fakes for the scoped-store-write unit tests (bug-hunt 10 / N3).
 * Not a test file itself (no `.test.ts` suffix), so the unit glob skips it.
 *
 * installFakeUserPool() puts a recording fake in the user-pool globalThis slot
 * (schema-ensure flags pre-set so no DDL runs). Every statement — pool.query or
 * a checked-out client — is recorded, whitespace-collapsed. `rowsFor` lets a
 * test hydrate specific rows (e.g. one origin_users row, so a signed access JWT
 * resolves to a real store user); `failFor` makes a statement throw.
 */

import assert from "node:assert/strict";

import { createPostgresPoolConfig } from "../../src/server/postgres-config";
import { issueAccessTokenForUser, ACCESS_COOKIE_NAME, ACCESS_FINGERPRINT_COOKIE_NAME } from "../../src/server/auth-jwt";
import type { StoredUser } from "../../src/server/store";

type G = Record<string, unknown>;
const g = globalThis as unknown as G;

export type FakePoolOptions = {
  rowsFor?: (sql: string) => unknown[] | undefined;
  failFor?: (sql: string) => boolean;
};

export function installFakeUserPool(options: FakePoolOptions = {}): string[] {
  const sql: string[] = [];
  const query = async (text: string) => {
    const normalized = text.replace(/\s+/g, " ").trim();
    sql.push(normalized);
    if (options.failFor?.(normalized)) throw new Error(`fake pool: forced failure for ${normalized}`);
    const rows = options.rowsFor?.(normalized) ?? [];
    return { rows, rowCount: rows.length };
  };
  const url = "postgres://fake:fake@127.0.0.1:1/fake_scoped_writes";
  process.env.USER_DATABASE_URL = url;
  g.__originUserSchemaEnsured = true;
  g.__originAppStoreSchemaEnsured = true;
  g.__originUserPool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
    end: async () => undefined,
  };
  g.__originUserPoolConnectionString = createPostgresPoolConfig(url, 25).connectionString;
  return sql;
}

/** A minimal origin_users row as `SELECT * FROM origin_users` returns it. */
export function userRow(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: "Scoped Student",
    email: `${id}@test.local`,
    password_hash: "x",
    role: "student",
    joined_at: new Date("2026-01-01T00:00:00Z"),
    usage_reset_at: new Date("2026-01-01T00:00:00Z"),
    auth_token_version: 0,
    subjects: [],
    streak: 0,
    total_study_time: 0,
    ...overrides,
  };
}

/** rowsFor that hydrates exactly these origin_users rows (and nothing else). */
export function usersOnly(rows: Record<string, unknown>[]) {
  return (sql: string) => (sql.startsWith("SELECT * FROM origin_users") ? rows : undefined);
}

const TEST_JWT_SECRET = Buffer.alloc(32, 7).toString("base64url");

/** A Request carrying a valid access JWT + fingerprint cookie for `userId`. */
export async function authedRequest(
  userId: string,
  url = "http://localhost/api/users/me",
  init: RequestInit = {},
): Promise<Request> {
  process.env.AUTH_JWT_SECRET_CURRENT ??= TEST_JWT_SECRET;
  const issued = await issueAccessTokenForUser(
    { id: userId, role: "student", authTokenVersion: 0 } as StoredUser,
    "sessionscoped",
  );
  const headers = new Headers(init.headers);
  headers.set(
    "cookie",
    `${ACCESS_COOKIE_NAME}=${issued.accessToken}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${issued.accessFingerprint}`,
  );
  return new Request(url, { ...init, headers });
}

/** Statements that write (anything but SELECT / transaction control). */
export function writesOf(sql: string[]): string[] {
  return sql.filter((s) => /^(INSERT|UPDATE|DELETE)/.test(s));
}

/** The `app.<table>` names the INSERT/UPDATE/DELETE statements touch. */
export function appTablesWritten(sql: string[]): string[] {
  return [...new Set(writesOf(sql).map((s) => s.match(/app\.[a-z_]+/)?.[0]).filter(Boolean) as string[])].sort();
}

/**
 * The N3 invariant: every DELETE is user-scoped (`WHERE … user_id = $n`) —
 * never `DELETE FROM app.<table>` / `DELETE FROM origin_auth_sessions` in full.
 */
export function assertNoUnscopedDelete(sql: string[]): void {
  for (const statement of sql.filter((s) => s.startsWith("DELETE"))) {
    assert.match(statement, /WHERE (.* )?user_id = \$\d/, `unscoped delete issued: ${statement}`);
  }
  assert.equal(
    sql.some((s) => s.startsWith("DELETE FROM origin_auth_sessions")),
    false,
    "auth sessions were rewritten",
  );
}

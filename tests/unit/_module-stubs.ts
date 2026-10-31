/**
 * Shared test plumbing: a fake pg pool and module-resolution stubs.
 *
 * Same technique as tests/cbt-quota-enforcement.test.ts — swap modules at the
 * `Module._load` layer BEFORE the code under test is `require`d. node:test runs
 * every test file in its own process, so a stub never leaks across files.
 *
 * Not a test file itself (no `.test.ts` suffix), so the unit glob skips it.
 */

import Module from "node:module";

export type FakeResult = { rows: Record<string, unknown>[]; rowCount?: number };
export type FakeHandler = (sql: string, params: unknown[]) => FakeResult | undefined;

export type FakePool = {
  queries: { sql: string; params: unknown[] }[];
  handler: FakeHandler;
  query: (sql: string, params?: unknown[]) => Promise<FakeResult>;
  connect: () => Promise<{ query: FakePool["query"]; release: () => void }>;
  /** Did any query so far contain this fragment? */
  ran: (fragment: string) => boolean;
  /** Queries containing this fragment. */
  matching: (fragment: string) => { sql: string; params: unknown[] }[];
  reset: () => void;
};

export function createFakePool(): FakePool {
  const fake: FakePool = {
    queries: [],
    handler: () => undefined,
    query(sql: string, params: unknown[] = []) {
      fake.queries.push({ sql, params });
      const result = fake.handler(sql, params) ?? { rows: [], rowCount: 0 };
      return Promise.resolve({ rowCount: result.rows.length, ...result });
    },
    connect() {
      return Promise.resolve({ query: fake.query, release: () => undefined });
    },
    ran: (fragment) => fake.queries.some((q) => q.sql.includes(fragment)),
    matching: (fragment) => fake.queries.filter((q) => q.sql.includes(fragment)),
    reset() {
      fake.queries = [];
      fake.handler = () => undefined;
    },
  };
  return fake;
}

type Loader = (...args: unknown[]) => unknown;

/**
 * Stub modules by request suffix (e.g. "@/server/user-postgres" or
 * "workspaces/audit"). A function value receives the real module so a stub can
 * spread it and override only what it needs.
 */
export function stubModules(stubs: Record<string, unknown>): void {
  const mod = Module as unknown as { _load: Loader };
  const previous = mod._load;
  mod._load = function patched(this: unknown, ...args: unknown[]) {
    const request = args[0] as string;
    for (const [suffix, stub] of Object.entries(stubs)) {
      if (request === suffix || request.endsWith(`/${suffix}`) || request.endsWith(suffix)) {
        if (typeof stub === "function") {
          return (stub as (real: unknown) => unknown)(previous.apply(this, args));
        }
        return stub;
      }
    }
    return previous.apply(this, args);
  };
}

/** The standard user-postgres stub, pointing every pool getter at `pool`. */
export function userPostgresStub(pool: FakePool) {
  return {
    getUserPostgresPool: () => pool,
    getUserPostgresReplicaPool: () => pool,
    isUserPostgresConfigured: () => true,
  };
}

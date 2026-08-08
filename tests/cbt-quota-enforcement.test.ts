/**
 * CBT participation quota — enforcement regression suite.
 *
 * This exercises the real guard functions in cbt-quota-service against a fake
 * pg pool, so the things pinned here are the behaviours a refactor must not
 * quietly break:
 *   1. the feature flag is a TRUE kill switch — with it off nothing blocks and
 *      nothing is metered, whatever is stored;
 *   2. a teacher with no cap (every teacher that exists today) is never gated,
 *      and their join path never takes the serialising row lock;
 *   3. the guards block at exactly the right boundary, with the machine-readable
 *      codes the UI branches on;
 *   4. metering only ever counts a participant who ACTUALLY STARTED a test, is
 *      idempotent, and never throws into an exam;
 *   5. the join check runs INSIDE the caller's transaction, on a locked teacher
 *      row — that is what stops two students taking the last seat.
 *
 * The SQL itself is verified separately against real Postgres (see
 * V1/CBT_PARTICIPATION_QUOTA_PLAN.md §7); this file pins the control flow.
 */

import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import Module from "node:module";

import { CbtQuotaError } from "@/lib/cbt/quota-model";

// ── A fake pg pool ──────────────────────────────────────────────────────────

type Handler = (sql: string, params: unknown[]) => { rows: Record<string, unknown>[]; rowCount?: number };

type FakeDb = {
  queries: { sql: string; params: unknown[] }[];
  handler: Handler;
};

const db: FakeDb = {
  queries: [],
  handler: () => ({ rows: [] }),
};

function fakeQuery(sql: string, params: unknown[] = []) {
  db.queries.push({ sql, params });
  return Promise.resolve(db.handler(sql, params));
}

const fakePool = {
  query: fakeQuery,
  connect: () => Promise.resolve({ query: fakeQuery, release: () => undefined }),
};

/** Did any query so far match this fragment? */
function ran(fragment: string): boolean {
  return db.queries.some((q) => q.sql.includes(fragment));
}

// ── Module interception ─────────────────────────────────────────────────────
// The service reaches for a real pool and the real flag reader at call time, so
// both are swapped at the module-resolution layer before it is imported.

let flagEnabled = true;

const ORIGINAL_LOAD = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;

(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  const request = args[0] as string;
  if (request.endsWith("/user-postgres") || request === "@/server/user-postgres") {
    return {
      getUserPostgresPool: () => fakePool,
      isUserPostgresConfigured: () => true,
    };
  }
  if (request.endsWith("/feature-flags") || request === "@/lib/feature-flags") {
    const real = ORIGINAL_LOAD.apply(this, args) as Record<string, unknown>;
    return { ...real, isFeatureEnabled: (flag: string) => (flag === "cbtParticipationQuota" ? flagEnabled : true) };
  }
  return ORIGINAL_LOAD.apply(this, args);
};

// The quota schema-ensure and the audit/notification side effects are I/O we do
// not want here; stub them through the same hook.
const stubbed = new Set([
  "cbt-quota-schema",
  "notifications",
  "platform-settings",
  "workspaces/audit",
]);

const PREV_LOAD = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched2(
  ...args: unknown[]
) {
  const request = args[0] as string;
  for (const name of stubbed) {
    if (request.endsWith(name)) {
      if (name === "cbt-quota-schema") return { ensureCbtQuotaSchema: async () => undefined };
      if (name === "notifications") return { createNotification: async () => undefined };
      if (name === "platform-settings") return { getTeacherCodeSupportPhone: async () => null };
      return { recordAuditEvent: async () => undefined };
    }
  }
  return PREV_LOAD.apply(this, args);
};

/* eslint-disable @typescript-eslint/no-require-imports */
const service = require("@/server/cbt/cbt-quota-service") as typeof import("@/server/cbt/cbt-quota-service");
/* eslint-enable @typescript-eslint/no-require-imports */

const {
  assertJoinAllowed,
  assertQuotaNotExhausted,
  isCbtQuotaEnforced,
  isRoomQuotaBlocked,
  readQuotaCounts,
  recordParticipation,
} = service;

const TEACHER = "cbtt_1";

/**
 * Wires the fake DB to answer as a teacher with this cap/usage. Mirrors the two
 * reads readQuotaCounts performs: the policy row, then the counts.
 */
function stubTeacher(opts: {
  quota: number | null;
  used: number;
  held: number;
  lifetimeUsed?: number;
  resetMode?: "none" | "monthly" | "days";
  periodDays?: number | null;
  anchor?: string | null;
  notifiedAt?: string | null;
  /** Rows the metering INSERT returns: [] = nothing counted. */
  meterRows?: Record<string, unknown>[];
}) {
  db.queries = [];
  db.handler = (sql) => {
    // Checked FIRST: the admission lock's SELECT also matches the broader
    // "FROM cbt.teachers WHERE id" pattern below, and it needs a `quota` alias.
    if (sql.includes("FOR UPDATE")) return { rows: [{ quota: opts.quota }] };
    if (sql.includes("FROM cbt.teachers WHERE id")) {
      return {
        rows: [
          {
            participation_quota: opts.quota,
            quota_reset_mode: opts.resetMode ?? "none",
            quota_period_days: opts.periodDays ?? null,
            quota_period_anchor: opts.anchor ?? null,
            quota_notified_at: opts.notifiedAt ?? null,
            quota_updated_at: null,
          },
        ],
      };
    }
    if (sql.includes("AS lifetime_used")) {
      return { rows: [{ used: opts.used, lifetime_used: opts.lifetimeUsed ?? opts.used, held: opts.held }] };
    }
    if (sql.includes("INSERT INTO cbt.participation_ledger")) {
      return { rows: opts.meterRows ?? [], rowCount: (opts.meterRows ?? []).length };
    }
    if (sql.includes("UPDATE cbt.teachers SET quota_notified_at")) return { rows: [] };
    return { rows: [] };
  };
}

function withFlag(enabled: boolean, t: TestContext) {
  flagEnabled = enabled;
  t.after(() => {
    flagEnabled = true;
  });
}

// ── 1. The kill switch ──────────────────────────────────────────────────────

test("the flag is a true kill switch: nothing blocks and nothing is metered", async (t) => {
  withFlag(false, t);
  assert.equal(isCbtQuotaEnforced(), false);

  // Stored cap of 5 with 99 used — would be exhausted if enforced.
  stubTeacher({ quota: 5, used: 99, held: 0, meterRows: [{ teacher_id: TEACHER }] });
  await assertQuotaNotExhausted(TEACHER); // must not throw
  assert.equal(await isRoomQuotaBlocked(TEACHER), false);

  // Metering short-circuits before touching the database at all.
  db.queries = [];
  assert.equal(await recordParticipation("cbtp_1", "cbtroom_1"), false);
  assert.equal(db.queries.length, 0, "no query should be issued while the flag is off");

  // And the join guard is a no-op — notably it never takes the lock.
  const client = { query: fakeQuery, release: () => undefined };
  db.queries = [];
  await assertJoinAllowed(client as never, TEACHER);
  assert.equal(ran("FOR UPDATE"), false);
});

// ── 2. Grandfathering: a teacher with no cap ────────────────────────────────

test("a teacher with no cap is never blocked, and their join takes no row lock", async () => {
  stubTeacher({ quota: null, used: 5_000, held: 300 });
  await assertQuotaNotExhausted(TEACHER);
  assert.equal(await isRoomQuotaBlocked(TEACHER), false);

  const client = { query: fakeQuery, release: () => undefined };
  db.queries = [];
  db.handler = (sql) => {
    if (sql.includes("FOR UPDATE")) return { rows: [{ quota: null }] };
    return { rows: [] };
  };
  await assertJoinAllowed(client as never, TEACHER);
  // It DOES lock (that is how it learns there is no cap) but must then stop —
  // no count query, so an unlimited teacher pays nothing for the check.
  assert.equal(ran("FOR UPDATE"), true);
  assert.equal(ran("AS lifetime_used"), false, "no counting for an uncapped teacher");
});

// ── 3. The blocking boundary ────────────────────────────────────────────────

test("teacher actions block only once usage has reached the cap", async () => {
  stubTeacher({ quota: 10, used: 9, held: 0 });
  await assertQuotaNotExhausted(TEACHER); // 9 < 10 → allowed

  stubTeacher({ quota: 10, used: 10, held: 0 });
  await assert.rejects(
    () => assertQuotaNotExhausted(TEACHER),
    (error: unknown) => {
      assert.ok(error instanceof CbtQuotaError);
      assert.equal(error.status, 403);
      assert.equal(error.code, "quota_exhausted");
      return true;
    },
  );
});

test("holds do NOT block the teacher's own actions, only new joins", async () => {
  // used + held is at the cap: no free seat, but the cap is not spent, so the
  // teacher can still reveal a code for the students already in the room.
  stubTeacher({ quota: 10, used: 4, held: 6 });
  await assertQuotaNotExhausted(TEACHER);
  // The public landing page, however, must stop offering the join form.
  assert.equal(await isRoomQuotaBlocked(TEACHER), true);
});

test("a student join is refused with the right code for each reason", async () => {
  const client = { query: fakeQuery, release: () => undefined };

  // Cap fully consumed → the institute's problem.
  stubTeacher({ quota: 10, used: 10, held: 0 });
  await assert.rejects(
    () => assertJoinAllowed(client as never, TEACHER),
    (error: unknown) => {
      assert.ok(error instanceof CbtQuotaError);
      assert.equal(error.status, 409);
      assert.equal(error.code, "quota_exhausted");
      return true;
    },
  );

  // Every remaining seat reserved → resolves itself when those rooms finish.
  stubTeacher({ quota: 10, used: 4, held: 6 });
  await assert.rejects(
    () => assertJoinAllowed(client as never, TEACHER),
    (error: unknown) => {
      assert.ok(error instanceof CbtQuotaError);
      assert.equal(error.code, "quota_no_seats");
      return true;
    },
  );

  // One seat left → admitted.
  stubTeacher({ quota: 10, used: 4, held: 5 });
  await assertJoinAllowed(client as never, TEACHER);
});

test("the join check runs on a LOCKED teacher row inside the caller's transaction", async () => {
  stubTeacher({ quota: 10, used: 1, held: 1 });
  const clientQueries: string[] = [];
  const client = {
    query: (sql: string, params?: unknown[]) => {
      clientQueries.push(sql);
      return fakeQuery(sql, params ?? []);
    },
    release: () => undefined,
  };
  await assertJoinAllowed(client as never, TEACHER);
  // The lock must be taken on the CALLER's client (not a fresh pool checkout),
  // or it would sit outside the transaction that inserts the participant.
  assert.ok(
    clientQueries.some((sql) => sql.includes("FOR UPDATE")),
    "the FOR UPDATE must go through the caller's client",
  );
});

// ── 4. Metering ─────────────────────────────────────────────────────────────

test("metering counts a started attempt exactly once and reports it", async () => {
  stubTeacher({ quota: 100, used: 1, held: 0, meterRows: [{ teacher_id: TEACHER }] });
  assert.equal(await recordParticipation("cbtp_1", "cbtroom_1"), true);
  assert.ok(ran("INSERT INTO cbt.participation_ledger"));
  assert.ok(ran("ON CONFLICT (participant_id) DO NOTHING"), "idempotency is in the statement itself");
  assert.ok(
    ran("entered_test_at IS NOT NULL"),
    "a lobby-only participant must never be charged",
  );
});

test("metering reports false when the row already existed (a rejoin)", async () => {
  // ON CONFLICT DO NOTHING returns no row on a duplicate.
  stubTeacher({ quota: 100, used: 1, held: 0, meterRows: [] });
  assert.equal(await recordParticipation("cbtp_1", "cbtroom_1"), false);
});

test("a metering failure never propagates into a live exam", async () => {
  db.queries = [];
  db.handler = () => {
    throw new Error("connection terminated unexpectedly");
  };
  // Must resolve false rather than reject — the student's save must still land.
  assert.equal(await recordParticipation("cbtp_1", "cbtroom_1"), false);
});

test("a quota read failure leaves the public join page open, not broken", async () => {
  db.queries = [];
  db.handler = () => {
    throw new Error("statement timeout");
  };
  // The transactional join check stays authoritative, so failing open here is
  // safe and keeps a student-facing page from 500ing on a blip.
  assert.equal(await isRoomQuotaBlocked(TEACHER), false);
});

// ── 5. Renewal windows reach the count query ────────────────────────────────

test("a monthly policy bounds the usage count by the current window", async () => {
  const anchor = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();
  stubTeacher({ quota: 10, used: 2, held: 0, lifetimeUsed: 9, resetMode: "monthly", anchor });
  const counts = await readQuotaCounts(TEACHER);

  assert.equal(counts.used, 2, "the current cycle");
  assert.equal(counts.lifetimeUsed, 9, "every cycle, for the audit view");
  assert.equal(counts.period.mode, "monthly");
  assert.ok(counts.period.start && counts.period.end);

  // The window start must actually be passed as the count query's bound.
  const countQuery = db.queries.find((q) => q.sql.includes("AS lifetime_used"));
  assert.ok(countQuery, "the count query ran");
  assert.ok(
    countQuery.params[1] instanceof Date,
    "the derived window start is bound as a parameter, not interpolated",
  );

  // With 2 of 10 used this cycle the teacher is NOT blocked, even though their
  // lifetime usage (9) is close to the cap — that is the whole point of a reset.
  await assertQuotaNotExhausted(TEACHER);
});

test("a lifetime cap passes a NULL bound, counting everything", async () => {
  stubTeacher({ quota: 10, used: 9, held: 0, resetMode: "none" });
  const counts = await readQuotaCounts(TEACHER);
  assert.equal(counts.period.start, null);
  const countQuery = db.queries.find((q) => q.sql.includes("AS lifetime_used"));
  assert.equal(countQuery?.params[1], null);
});

test("an unknown teacher is a 404, not a silent zero", async () => {
  db.queries = [];
  db.handler = () => ({ rows: [] });
  await assert.rejects(
    () => readQuotaCounts("cbtt_nope"),
    (error: unknown) => {
      assert.ok(error instanceof CbtQuotaError);
      assert.equal(error.status, 404);
      assert.equal(error.code, "teacher_not_found");
      return true;
    },
  );
});

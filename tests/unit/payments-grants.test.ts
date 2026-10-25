import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";

import {
  paidTermExpiry,
  rebasePaidGrantExpiries,
  rebasePaidGrantExpiriesForSubject,
} from "../../src/server/payments/grants";

test("paidTermExpiry starts at now when an existing grant is expired", () => {
  const now = new Date("2026-08-22T00:00:00.000Z");
  assert.equal(
    paidTermExpiry(new Date("2026-07-01T00:00:00.000Z"), 1, now).toISOString(),
    "2026-09-22T00:00:00.000Z",
  );
});

test("paidTermExpiry extends from the later existing expiry", () => {
  const now = new Date("2026-08-22T00:00:00.000Z");
  assert.equal(
    paidTermExpiry(new Date("2026-12-15T12:30:00.000Z"), 3, now).toISOString(),
    "2027-03-15T12:30:00.000Z",
  );
});

test("paidTermExpiry uses calendar months and clamps month-end dates", () => {
  const now = new Date("2026-01-31T10:00:00.000Z");
  assert.equal(
    paidTermExpiry(null, 1, now).toISOString(),
    "2026-02-28T10:00:00.000Z",
  );
  assert.equal(
    paidTermExpiry(null, 12, now).toISOString(),
    "2027-01-31T10:00:00.000Z",
  );
});

test("paidTermExpiry rejects invalid terms", () => {
  assert.throws(() => paidTermExpiry(null, 0), /positive integer/);
  assert.throws(() => paidTermExpiry(null, 1.5), /positive integer/);
});


// ─── after a processed refund (P4) ─────────────────────────────────────────────
// A processed full refund revokes the refunded order's grant and then rebases
// the student's surviving paid grants for that subject, so the refunded term is
// no longer stacked in front of them.

test("rebasePaidGrantExpiries: dropping a refunded purchase pulls the survivor back to its own start", () => {
  const stacked = rebasePaidGrantExpiries([
    { id: "g_refunded", paidAt: "2026-08-01T00:00:00.000Z", termMonths: 3 },
    { id: "g_kept", paidAt: "2026-08-10T00:00:00.000Z", termMonths: 1 },
  ]);
  assert.equal(stacked.find((g) => g.id === "g_kept")?.expiresAt.toISOString(), "2026-12-01T00:00:00.000Z");

  const afterRefund = rebasePaidGrantExpiries([
    { id: "g_kept", paidAt: "2026-08-10T00:00:00.000Z", termMonths: 1 },
  ]);
  assert.deepEqual(
    afterRefund.map((g) => [g.id, g.expiresAt.toISOString()]),
    [["g_kept", "2026-09-10T00:00:00.000Z"]],
  );
});

test("rebasePaidGrantExpiriesForSubject rewrites only the still-active survivors, under the user lock", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (/^SELECT g\.\*/.test(calls[calls.length - 1].sql)) {
        // The refunded order's grant was revoked first, so only the survivor is
        // returned by the `status = 'active'` scan.
        return {
          rows: [{
            id: "g_kept",
            user_id: "user_1",
            subject: "physics",
            order_id: "ord_kept",
            source: "paid_order",
            status: "active",
            expires_at: new Date("2026-12-01T00:00:00.000Z"),
            created_at: new Date("2026-08-10T00:00:00.000Z"),
            updated_at: new Date("2026-08-10T00:00:00.000Z"),
            paid_at_for_rebase: new Date("2026-08-10T00:00:00.000Z"),
            term_months_for_rebase: 1,
          }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as PoolClient;

  const rebased = await rebasePaidGrantExpiriesForSubject({ userId: "user_1", subject: "Physics", client });

  assert.match(calls[0].sql, /pg_advisory_xact_lock/);
  assert.deepEqual(calls[0].params, ["user_1"]);
  assert.match(calls[1].sql, /g\.status = 'active'/);
  assert.deepEqual(calls[1].params, ["user_1", "physics"]);
  const update = calls.find((c) => c.sql.startsWith("UPDATE entitlements.subject_grants SET expires_at"));
  assert.ok(update);
  assert.equal(update.params[0], "g_kept");
  assert.equal((update.params[1] as Date).toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(rebased[0]?.expiresAt, "2026-09-10T00:00:00.000Z");
});

test("rebasePaidGrantExpiriesForSubject refuses an unknown subject before touching the database", async () => {
  let touched = false;
  const client = { query: async () => { touched = true; return { rows: [], rowCount: 0 }; } } as unknown as PoolClient;
  await assert.rejects(
    rebasePaidGrantExpiriesForSubject({ userId: "user_1", subject: "astrology", client }),
    /valid subject/,
  );
  assert.equal(touched, false);
});

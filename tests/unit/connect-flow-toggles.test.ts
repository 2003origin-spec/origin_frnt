/**
 * Collaboration per-flow toggles are enforced, and CONNECT_AUTO_APPROVE in
 * hosted production is loudly visible (behaviour unchanged).
 *
 * flow1Enabled / flow2Enabled were stored and editable in /admin/collaborations
 * but `isActiveCollaboration` only checked `status = 'active'`, so an admin who
 * switched Flow 1 off for a bad institute did not stop its free grants.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules, userPostgresStub } from "./_module-stubs";

const pool = createFakePool();

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "collaboration-schema": { ensureCollaborationSchema: async () => undefined },
  "workspaces/audit": { recordAuditEvent: async () => undefined },
});

/* eslint-disable @typescript-eslint/no-require-imports */
const service = require("@/server/connect/collaboration-service") as typeof import("@/server/connect/collaboration-service");
/* eslint-enable @typescript-eslint/no-require-imports */

/** A live institute collaboration with the given toggles, evaluated like the SQL does. */
function collaboration(flags: { flow1: boolean; flow2: boolean } | null) {
  pool.reset();
  pool.handler = (sql, params) => {
    if (!sql.includes("FROM app.origin_collaborations c")) return undefined;
    if (!flags) return { rows: [] };
    assert.match(sql, /\$2::text = 'flow1' AND c\.flow1_enabled/);
    assert.match(sql, /\$2::text = 'flow2' AND c\.flow2_enabled/);
    const flow = params[1] as string | null;
    const ok = flow === null || (flow === "flow1" && flags.flow1) || (flow === "flow2" && flags.flow2);
    return { rows: ok ? [{ "?column?": 1 }] : [] };
  };
}

async function status(promise: Promise<unknown>): Promise<number | "ok"> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return (error as { status: number }).status;
  }
}

test("no flow → only the collaboration/workspace status matters (browse/profile path)", async () => {
  collaboration({ flow1: false, flow2: false });
  assert.equal(await service.isActiveCollaborator("ws_1"), true);
  assert.deepEqual(pool.queries.at(-1)?.params, ["ws_1", null]);
});

test("flow1 disabled → Flow-1 refused, Flow-2 still allowed", async () => {
  collaboration({ flow1: false, flow2: true });
  assert.equal(await service.isActiveCollaborator("ws_1", "flow1"), false);
  assert.equal(await service.isActiveCollaborator("ws_1", "flow2"), true);
  await assert.rejects(service.assertActiveCollaborator("ws_1", "flow1"), {
    status: 403,
    message: /not accepting ORIGIN code redemptions/,
  });
  assert.equal(await status(service.assertActiveCollaborator("ws_1", "flow2")), "ok");
});

test("flow2 disabled → paid checkout refused, Flow-1 still allowed", async () => {
  collaboration({ flow1: true, flow2: false });
  await assert.rejects(service.assertActiveCollaborator("ws_1", "flow2"), {
    status: 403,
    message: /not accepting paid enrollments/,
  });
  assert.equal(await status(service.assertActiveCollaborator("ws_1", "flow1")), "ok");
});

test("not a collaborator at all → the generic 403", async () => {
  collaboration(null);
  await assert.rejects(service.assertActiveCollaborator("ws_1", "flow1"), {
    status: 403,
    message: /not an active ORIGIN collaborator/,
  });
});

test("redeem + subject pick gate on flow1, paid checkout gates on flow2", () => {
  const read = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");
  const connect = read("server/connect/connect-service.ts");
  assert.match(connect, /assertActiveCollaborator\(hit\.workspace\.id, "flow1"\)/);
  assert.match(connect, /assertActiveCollaborator\(input\.workspaceId, "flow1"\)/);
  const checkout = read("server/connect/enrollment-subscription-service.ts");
  assert.match(checkout, /assertActiveCollaborator\(input\.workspaceId, "flow2"\)/);
});

test("CONNECT_AUTO_APPROVE warns only when on AND in hosted production", (t) => {
  const warnings: string[] = [];
  t.mock.method(console, "warn", (msg: string) => warnings.push(msg));
  const saved = { a: process.env.CONNECT_AUTO_APPROVE, v: process.env.VERCEL_ENV };
  try {
    process.env.CONNECT_AUTO_APPROVE = "1";
    process.env.VERCEL_ENV = "preview";
    assert.equal(service.warnIfAutoApproveInProduction(), false);

    process.env.VERCEL_ENV = "production";
    assert.equal(service.warnIfAutoApproveInProduction(), true);
    assert.match(warnings.at(-1) ?? "", /CONNECT_AUTO_APPROVE is ON in hosted production/);

    delete process.env.CONNECT_AUTO_APPROVE;
    assert.equal(service.warnIfAutoApproveInProduction(), false);
    assert.equal(warnings.length, 1);
  } finally {
    if (saved.a === undefined) delete process.env.CONNECT_AUTO_APPROVE;
    else process.env.CONNECT_AUTO_APPROVE = saved.a;
    if (saved.v === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = saved.v;
  }
});

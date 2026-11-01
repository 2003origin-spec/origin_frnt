/**
 * Browse lists approved collaborators with the filter IN SQL, so pagination
 * pages over partners.
 *
 * listActiveCollaborators used to fetch the newest 60 (max 100) institute
 * workspaces of ANY collaboration status and filter in memory, so once more
 * than that many institutes signed up, older approved partners disappeared
 * from Browse and /api/marketplace/institutes.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules, userPostgresStub } from "./_module-stubs";

const pool = createFakePool();
stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "collaboration-schema": { ensureCollaborationSchema: async () => undefined },
});

/* eslint-disable @typescript-eslint/no-require-imports */
const connect = require("@/server/connect/connect-service") as typeof import("@/server/connect/connect-service");
/* eslint-enable @typescript-eslint/no-require-imports */

function institute(id: string) {
  return {
    id,
    display_name: id,
    legal_name: null,
    city: null,
    state: null,
    country: "IN",
    subjects: [],
    courses: [],
    verification_status: "verified",
    student_count: 0,
    batch_count: 0,
  };
}

test("collaborator filter + LIMIT/OFFSET run in one SQL query", async () => {
  pool.reset();
  pool.handler = (sql) =>
    sql.includes("FROM app.teacher_workspaces w") ? { rows: [institute("ws_3"), institute("ws_4")] } : undefined;

  const page = await connect.listActiveCollaborators({ subject: "physics", limit: 2, offset: 2 });

  assert.deepEqual(page.map((i) => i.workspaceId), ["ws_3", "ws_4"]);
  const [query] = pool.matching("FROM app.teacher_workspaces w");
  assert.match(query.sql, /EXISTS \(SELECT 1 FROM app\.origin_collaborations c\s+WHERE c\.workspace_id = w\.id AND c\.status = 'active'\)/);
  assert.match(query.sql, /LIMIT \$2 OFFSET \$3/);
  assert.deepEqual(query.params, ["physics", 2, 2]);
  // No separate "all active collaborator ids" fetch + in-memory filter any more.
  assert.equal(pool.ran("SELECT c.workspace_id"), false);
});

test("defaults: limit 60, offset 0; a negative offset is clamped", async () => {
  pool.reset();
  await connect.listActiveCollaborators();
  await connect.listActiveCollaborators({ offset: -5 });
  const queries = pool.matching("FROM app.teacher_workspaces w");
  assert.deepEqual(queries[0].params, [60, 0]);
  assert.deepEqual(queries[1].params, [60, 0]);
});

test("both browse routes accept ?offset=", () => {
  for (const route of ["marketplace/institutes/route.ts", "connect/collaborators/route.ts"]) {
    const src = readFileSync(new URL(`../../src/app/api/${route}`, import.meta.url), "utf8");
    assert.match(src, /searchParams\.get\("offset"\)/, route);
    assert.match(src, /listBrowsableInstitutes\(\{[^}]*offset/, route);
  }
});

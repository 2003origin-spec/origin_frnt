/**
 * Flow 1 "exactly ONE free subject per institute" — race regression.
 *
 * grantConnectSubject used to read-then-insert with no lock, so four parallel
 * picks (physics, chemistry, mathematics, biology) all passed the read and all
 * inserted. The guard is now the uq_subject_grants_one_teacher_code partial
 * unique index behind insertTeacherCodeGrant's ON CONFLICT DO NOTHING + re-read.
 *
 * The fake DB below models exactly that: the pre-read always sees "nothing yet"
 * (every racer reads before anyone inserts), and the INSERT enforces the index.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFakePool, stubModules, userPostgresStub } from "./_module-stubs";

const pool = createFakePool();
const recomputed: string[] = [];
const audits: string[] = [];

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "subject-grants-schema": {
    ensureSubjectGrantsSchema: async () => undefined,
    TEACHER_CODE_UNIQUE_INDEX: "uq_subject_grants_one_teacher_code",
  },
  "@/server/entitlements": {
    recomputeUserPremiumFlags: async (id: string) => {
      recomputed.push(id);
    },
    recomputePremiumFlagsForUsers: async () => undefined,
  },
  "workspaces/audit": {
    recordAuditEvent: async (e: { action: string }) => {
      audits.push(e.action);
    },
  },
  "@/server/workspaces/enrollments": {
    getEnrollment: async (workspaceId: string, studentId: string) => ({
      id: "enr_1",
      workspaceId,
      studentId,
      status: "unassigned",
    }),
    listStudentInstituteEnrollments: async () => [],
  },
  "./collaboration-service": {
    assertActiveCollaborator: async () => undefined,
  },
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { grantConnectSubject } = require("@/server/connect/connect-service") as typeof import("@/server/connect/connect-service");
/* eslint-enable @typescript-eslint/no-require-imports */

type Row = Record<string, unknown>;

function installGrantTable(): Row[] {
  const table: Row[] = [];
  pool.reset();
  recomputed.length = 0;
  audits.length = 0;
  pool.handler = (sql, params) => {
    if (sql.includes("INSERT INTO entitlements.subject_grants")) {
      assert.match(sql, /ON CONFLICT DO NOTHING/);
      const [id, userId, subject, workspaceId] = params as string[];
      const clash = table.some(
        (r) =>
          r.user_id === userId &&
          r.workspace_id === workspaceId &&
          r.source === "teacher_code" &&
          r.status === "active",
      );
      if (clash) return { rows: [] };
      const now = new Date().toISOString();
      const row: Row = {
        id,
        user_id: userId,
        subject,
        source: "teacher_code",
        workspace_id: workspaceId,
        enrollment_id: params[4],
        status: "active",
        expires_at: params[5],
        granted_by: null,
        created_at: now,
        updated_at: now,
      };
      table.push(row);
      return { rows: [row] };
    }
    // The re-read after a lost insert sees the real table.
    if (sql.includes("ORDER BY (subject = $3) DESC")) {
      const [userId, workspaceId, subject] = params as string[];
      const live = table.filter(
        (r) => r.user_id === userId && r.workspace_id === workspaceId && r.status === "active",
      );
      live.sort((a, b) => Number(b.subject === subject) - Number(a.subject === subject));
      return { rows: live.slice(0, 1) };
    }
    // The fast-path pre-read: every racer reads before anyone has inserted.
    if (sql.includes("FROM entitlements.subject_grants")) return { rows: [] };
    return undefined;
  };
  return table;
}

test("four parallel picks of different subjects create exactly ONE grant", async () => {
  const table = installGrantTable();
  const subjects = ["physics", "chemistry", "mathematics", "biology"];
  const results = await Promise.allSettled(
    subjects.map((subject) =>
      grantConnectSubject({ studentId: "stu_1", workspaceId: "ws_1", subject }),
    ),
  );

  assert.equal(table.length, 1, "only one teacher_code grant row may exist");
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 3);
  for (const r of rejected) {
    assert.equal((r.reason as { status?: number }).status, 409);
  }
  // Entitlement + audit side effects run once, for the winning insert only.
  assert.deepEqual(recomputed, ["stu_1"]);
  assert.deepEqual(audits, ["subject_grant.granted"]);
});

test("parallel picks of the SAME subject are idempotent", async () => {
  const table = installGrantTable();
  const [a, b] = await Promise.all([
    grantConnectSubject({ studentId: "stu_2", workspaceId: "ws_1", subject: "physics" }),
    grantConnectSubject({ studentId: "stu_2", workspaceId: "ws_1", subject: "physics" }),
  ]);
  assert.equal(table.length, 1);
  assert.equal(a.id, b.id);
  assert.equal(a.subject, "physics");
});

test("a pick at a second institute is still allowed (the limit is per institute)", async () => {
  const table = installGrantTable();
  await grantConnectSubject({ studentId: "stu_3", workspaceId: "ws_1", subject: "physics" });
  await grantConnectSubject({ studentId: "stu_3", workspaceId: "ws_2", subject: "chemistry" });
  assert.equal(table.length, 2);
});

test("schema ensure and migration declare the one-per-institute partial unique index", () => {
  const schema = readFileSync(
    new URL("../../src/server/connect/subject-grants-schema.ts", import.meta.url),
    "utf8",
  );
  const migration = readFileSync(
    new URL("../../src/db/migrations/20261022_teacher_code_grant_unique.sql", import.meta.url),
    "utf8",
  );
  const rollback = readFileSync(
    new URL("../../src/db/migrations/20261022_teacher_code_grant_unique.rollback.sql", import.meta.url),
    "utf8",
  );
  const predicate = /WHERE status = 'active' AND source = 'teacher_code' AND workspace_id IS NOT NULL/;
  for (const text of [schema, migration]) {
    assert.match(text, /subject_grants\(user_id, workspace_id\)/);
    assert.match(text, predicate);
  }
  // Runtime ensure must not roll back the whole schema on pre-existing duplicates.
  assert.match(schema, /EXCEPTION WHEN unique_violation THEN/);
  // The migration carries the one-off duplicate finder.
  assert.match(migration, /HAVING COUNT\(\*\) > 1/);
  assert.match(rollback, /DROP INDEX IF EXISTS entitlements\.uq_subject_grants_one_teacher_code/);
});

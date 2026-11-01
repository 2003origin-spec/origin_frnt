/**
 * A3(b) — removing a sub-admin must log them out of everything, on BOTH the
 * hard-delete path and the FK-protected demote fallback. `removeSubAdmin` is
 * the injected-primitives core of `deleteSubAdmin` (admins-service.ts is
 * `server-only`, so the service module itself is exercised in integration).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { removeSubAdmin, type SubAdminRemovalDb, type SubAdminRow } from "@/server/admin/sub-admin-removal";
import { AuthzError } from "@/server/authz";

type Call = { op: "find" | "delete" | "demote" | "revoke"; id: string };

function fakeDb(row: SubAdminRow | null, options: { deleteFails?: boolean } = {}) {
  const calls: Call[] = [];
  const db: SubAdminRemovalDb = {
    findAdmin: async (id) => {
      calls.push({ op: "find", id });
      return row;
    },
    deleteUser: async (id) => {
      calls.push({ op: "delete", id });
      if (options.deleteFails) throw new Error("violates foreign key constraint");
    },
    demoteToStudent: async (id) => {
      calls.push({ op: "demote", id });
    },
    revokeAllSessions: async (id) => {
      calls.push({ op: "revoke", id });
    },
  };
  return { db, calls, ops: () => calls.map((call) => call.op) };
}

const notProtected = () => false;
const subAdmin: SubAdminRow = { email: "sub@example.com", is_main_admin: false, role: "admin" };

test("hard delete bumps the token version and revokes sessions before the row goes", async () => {
  const { db, ops, calls } = fakeDb(subAdmin);
  const result = await removeSubAdmin(db, "user_sub", notProtected);
  assert.equal(result.outcome, "deleted");
  assert.deepEqual(ops(), ["find", "revoke", "delete"]);
  assert.ok(calls.every((call) => call.id === "user_sub"));
});

test("the FK-fallback demote also bumps the version (idempotently, again after the UPDATE)", async () => {
  const { db, ops } = fakeDb(subAdmin, { deleteFails: true });
  const result = await removeSubAdmin(db, "user_sub", notProtected);
  assert.equal(result.outcome, "demoted");
  // Without the second revoke a demoted sub-admin would keep `role: admin` in
  // their JWT with a version that still matches the row.
  assert.deepEqual(ops(), ["find", "revoke", "delete", "demote", "revoke"]);
});

test("the main admin (flag or configured email) cannot be removed and nothing is revoked", async () => {
  const flagged = fakeDb({ ...subAdmin, is_main_admin: true });
  await assert.rejects(removeSubAdmin(flagged.db, "user_main", notProtected), (error: unknown) => {
    assert.ok(error instanceof AuthzError);
    assert.equal(error.status, 403);
    return true;
  });
  assert.deepEqual(flagged.ops(), ["find"]);

  const configured = fakeDb({ ...subAdmin, email: "adminoffice@o3origin.com" });
  await assert.rejects(
    removeSubAdmin(configured.db, "user_main", (email) => email === "adminoffice@o3origin.com"),
    AuthzError,
  );
  assert.deepEqual(configured.ops(), ["find"]);
});

test("a missing row or a non-admin row is a 404 and nothing is revoked", async () => {
  const missing = fakeDb(null);
  await assert.rejects(removeSubAdmin(missing.db, "nope", notProtected), (error: unknown) => {
    assert.ok(error instanceof AuthzError);
    assert.equal(error.status, 404);
    return true;
  });
  assert.deepEqual(missing.ops(), ["find"]);

  const student = fakeDb({ ...subAdmin, role: "student" });
  await assert.rejects(removeSubAdmin(student.db, "user_student", notProtected), AuthzError);
  assert.deepEqual(student.ops(), ["find"]);
});

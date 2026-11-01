import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { ACCESS_FINGERPRINT_HEADER, issueAccessTokenForUser } from "../src/server/auth-jwt";
import { withStoredUserDefaults, type StoredUser } from "../src/server/store";

// Test-only signing key (same fixture as tests/auth-jwt.test.ts).
process.env.AUTH_JWT_SECRET_CURRENT ??= "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const user = (role: StoredUser["role"]) =>
  withStoredUserDefaults({ id: `user_${role}`, name: "U", email: `${role}@example.test`, password: "", role } as StoredUser);

async function post(role: StoredUser["role"]) {
  const issued = await issueAccessTokenForUser(user(role), "session_1");
  const { POST } = await import("../src/app/api/teacher/workspaces/route");
  return POST(
    new NextRequest(new URL("/api/teacher/workspaces", "https://www.o3origin.com"), {
      method: "POST",
      headers: { authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: issued.accessFingerprint, "content-type": "application/json" },
      body: JSON.stringify({ workspaceType: "personal", displayName: "Hack Academy" }),
    }),
  );
}

test("students cannot create a teacher workspace (and become its owner)", async () => {
  const res = await post("student");
  assert.equal(res.status, 403);
  assert.match(String(((await res.json()) as { detail?: string }).detail), /teacher/i);
});

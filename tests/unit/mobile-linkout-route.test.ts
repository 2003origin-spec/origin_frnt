/**
 * A3 — the app → browser link-out handoff carries the JWT's token version and
 * the consumer compares it with the user row before minting a browser session.
 *
 * Runs against the seed store (no Postgres): the "revoked in the window" case
 * is modelled as a handoff issued under a version the row does not carry.
 */

import test from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";

import { GET, POST } from "@/app/api/mobile/[...slug]/route";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_FINGERPRINT_COOKIE_NAME,
  issueAccessTokenForUser,
  REFRESH_COOKIE_NAME,
} from "@/server/auth-jwt";
import { readStoreAsync, resetStore, type StoredUser } from "@/server/store";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const APP_UA = "Mozilla/5.0 (Linux; Android 14) OriginApp/10000 (com.o3origin.app)";

/** These exercise the seed-store path, so make sure Postgres is not picked up. */
function withoutPostgres<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  return run().finally(() => {
    if (previous) process.env.USER_DATABASE_URL = previous;
  });
}

function routeContext(slug: string[]) {
  return { params: Promise.resolve({ slug }) };
}

async function issueLinkOut(user: StoredUser): Promise<Response> {
  const issued = await issueAccessTokenForUser(user, "sess_app");
  const request = new Request("https://www.o3origin.com/api/mobile/link-out", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": APP_UA,
      cookie: `${ACCESS_COOKIE_NAME}=${issued.accessToken}; ${ACCESS_FINGERPRINT_COOKIE_NAME}=${issued.accessFingerprint}`,
      "x-origin-user-id": user.id,
    },
    body: JSON.stringify({ purpose: "premium" }),
  });
  return POST(request as NextRequest, routeContext(["link-out"]));
}

async function consume(url: string): Promise<Response> {
  const token = new URL(url).searchParams.get("token") ?? "";
  const request = new Request(
    `https://www.o3origin.com/api/mobile/link-out/consume?token=${encodeURIComponent(token)}`,
    { headers: { "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/126.0" } },
  );
  // The handler reads request.nextUrl; a plain Request is enough once it is given one.
  Object.defineProperty(request, "nextUrl", { value: new URL(request.url) });
  return GET(request as unknown as NextRequest, routeContext(["link-out", "consume"]));
}

function cookieNames(response: Response): string[] {
  return response.headers.getSetCookie().map((cookie) => cookie.split("=")[0]);
}

async function seedStudent(): Promise<StoredUser> {
  resetStore();
  const store = await readStoreAsync();
  const student = store.users.find((entry) => entry.role === "student");
  assert.ok(student, "seed store has a student");
  return student;
}

test("issuing a handoff needs a valid access JWT, not just the middleware header", async () => {
  await withoutPostgres(async () => {
    const student = await seedStudent();
    const request = new Request("https://www.o3origin.com/api/mobile/link-out", {
      method: "POST",
      headers: { "content-type": "application/json", "x-origin-user-id": student.id },
      body: "{}",
    });
    const response = await POST(request as NextRequest, routeContext(["link-out"]));
    assert.equal(response.status, 401);
  });
});

test("a handoff issued under the current token version bootstraps a web session", async () => {
  await withoutPostgres(async () => {
    const student = await seedStudent();
    const issued = await issueLinkOut(student);
    assert.equal(issued.status, 200);
    const { url } = (await issued.json()) as { url: string };

    const response = await consume(url);
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location") ?? "").pathname, "/premium");
    const names = cookieNames(response);
    assert.ok(names.includes(ACCESS_COOKIE_NAME));
    assert.ok(names.includes(REFRESH_COOKIE_NAME));
  });
});

test("a handoff whose token version the row no longer carries is refused (no session minted)", async () => {
  await withoutPostgres(async () => {
    const student = await seedStudent();
    // The app's JWT is still signature-valid, but a revoke / delete bumped the
    // row's auth_token_version after it was minted.
    const issued = await issueLinkOut({ ...student, authTokenVersion: (student.authTokenVersion ?? 0) + 1 });
    assert.equal(issued.status, 200);
    const { url } = (await issued.json()) as { url: string };

    const response = await consume(url);
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location") ?? "");
    assert.equal(location.pathname, "/auth");
    assert.equal(location.searchParams.get("handoff"), "expired");
    assert.deepEqual(cookieNames(response), []);
  });
});

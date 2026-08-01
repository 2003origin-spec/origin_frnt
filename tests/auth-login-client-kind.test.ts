import test from "node:test";
import assert from "node:assert/strict";

import { handleLogin, handleRefresh, handleUsersRequest } from "../src/legacy/users";
import { readStoreAsync, resetStore } from "../src/server/store";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS_NATIVE,
} from "../src/server/auth-jwt";

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14) OriginApp/10000 (com.o3origin.app)";
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36";
const SEED_EMAIL = "student@origin.test";
const SEED_PASSWORD = "password123";

/** These exercise the seed-store path, so make sure Postgres is not picked up. */
function withoutPostgres<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  return run().finally(() => {
    if (previous) process.env.USER_DATABASE_URL = previous;
  });
}

async function newestSession() {
  const store = await readStoreAsync();
  return store.authSessions[store.authSessions.length - 1];
}

function ttlSecondsOf(expiresAt: string): number {
  return Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000);
}

test("a login from the android shell mints an until-sign-out session", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const response = await handleLogin({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      role: "student",
      clientKind: "android",
    });
    assert.equal(response.status, 200);

    const session = await newestSession();
    assert.equal(session.clientKind, "android");
    assert.ok(Math.abs(ttlSecondsOf(session.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS_NATIVE) <= 5);
  });
});

test("a login with no client kind mints the 7-day web session", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const response = await handleLogin({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      role: "student",
    });
    assert.equal(response.status, 200);

    const session = await newestSession();
    assert.equal(session.clientKind, "web");
    assert.ok(Math.abs(ttlSecondsOf(session.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS) <= 5);
  });
});

test("the REST login route derives the client kind from the UA, ignoring the body", async () => {
  await withoutPostgres(async () => {
    resetStore();
    // A caller asking for the long-lived android session from an ordinary
    // browser must not get one: clientKind is server-derived, never an input.
    const request = new Request("https://www.o3origin.com/api/users/login", {
      method: "POST",
      headers: { "user-agent": BROWSER_UA, "content-type": "application/json" },
    });
    const response = await handleUsersRequest("POST", ["login"], request, {
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      role: "student",
      clientKind: "android",
    });
    assert.equal(response.status, 200);

    const session = await newestSession();
    assert.equal(session.clientKind, "web");
    assert.ok(Math.abs(ttlSecondsOf(session.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS) <= 5);
  });
});

test("the REST login route honours a genuine android shell UA", async () => {
  await withoutPostgres(async () => {
    resetStore();
    const request = new Request("https://www.o3origin.com/api/users/login", {
      method: "POST",
      headers: { "user-agent": ANDROID_UA, "content-type": "application/json" },
    });
    const response = await handleUsersRequest("POST", ["login"], request, {
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      role: "student",
    });
    assert.equal(response.status, 200);

    const session = await newestSession();
    assert.equal(session.clientKind, "android");
    assert.ok(Math.abs(ttlSecondsOf(session.refreshTokenExpiresAt) - REFRESH_TOKEN_TTL_SECONDS_NATIVE) <= 5);
  });
});

test("refresh reports the STORED client kind, not the requesting UA", async () => {
  await withoutPostgres(async () => {
    resetStore();
    await handleLogin({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      role: "student",
      clientKind: "android",
    });
    const session = await newestSession();

    // Refresh the android session from a plain browser UA. The cookie lifetime
    // the caller sets is driven by this value, so a downgrade here would evict
    // the android refresh cookie after 7 days.
    const response = await handleRefresh(
      new Request("https://www.o3origin.com/api/users/token/refresh", {
        method: "POST",
        headers: { "user-agent": BROWSER_UA },
      }),
      { refresh: session.refreshToken },
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.clientKind, "android");
  });
});

test("refreshing a web session keeps reporting web", async () => {
  await withoutPostgres(async () => {
    resetStore();
    await handleLogin({ email: SEED_EMAIL, password: SEED_PASSWORD, role: "student" });
    const session = await newestSession();

    const response = await handleRefresh(null, { refresh: session.refreshToken });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.clientKind, "web");
  });
});

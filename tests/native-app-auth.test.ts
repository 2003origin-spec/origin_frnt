import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  ACCESS_FINGERPRINT_HEADER,
  extractAccessFingerprint,
  isBearerOnlyRequest,
  issueAccessTokenForUser,
  verifyRequestAccessJwt,
} from "../src/server/auth-jwt";
import { handleAppAuth, isBrowserRequest, toAppTokens } from "../src/server/mobile/app-auth";
import { getApiRoutePolicy } from "../src/server/route-policy";
import { middleware } from "../src/middleware";
import { withStoredUserDefaults, type StoredUser } from "../src/server/store";

// V1/NATIVE_APP_API_PLAN.md — bearer auth, CSRF bypass and body-token endpoints.

process.env.AUTH_JWT_SECRET_CURRENT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

function user(): StoredUser {
  return withStoredUserDefaults({
    id: "user_app_1",
    name: "App User",
    email: "app@example.com",
    password: "",
    role: "student",
    studentClass: null,
    fieldOfInterest: null,
    referralSource: null,
    avatar: null,
    streak: 0,
    totalStudyTime: 0,
    joinedAt: new Date(0).toISOString(),
    isPremium: false,
    premiumExpiry: null,
    isOnboarded: true,
    selectedCourse: null,
    isDropper: false,
    yearsOfExperience: null,
    subjects: [],
    studentCapacity: null,
  });
}

function req(url: string, init: { method?: string; headers?: Record<string, string> } = {}): NextRequest {
  return new NextRequest(new URL(url, "https://www.o3origin.com"), { method: init.method ?? "GET", headers: init.headers });
}

test("fingerprint header is read only for bearer requests", () => {
  const bearer = req("/api/mobile/push-tokens", { headers: { authorization: "Bearer abc", [ACCESS_FINGERPRINT_HEADER]: "fgp-header" } });
  assert.equal(extractAccessFingerprint(bearer), "fgp-header");

  // A cookie-authenticated (browser) request cannot smuggle a fingerprint in a header.
  const cookieOnly = req("/api/users/me", { headers: { cookie: "origin_access_token=t", [ACCESS_FINGERPRINT_HEADER]: "fgp-header" } });
  assert.equal(extractAccessFingerprint(cookieOnly), null);

  // Bearer without the header still falls back to the cookie.
  const bearerCookieFgp = req("/api/users/me", { headers: { authorization: "Bearer abc", cookie: "origin_access_fgp=fgp-cookie" } });
  assert.equal(extractAccessFingerprint(bearerCookieFgp), "fgp-cookie");
});

test("bearer-only means a bearer token and no Origin auth cookies", () => {
  assert.equal(isBearerOnlyRequest(req("/api/x", { headers: { authorization: "Bearer abc" } })), true);
  assert.equal(isBearerOnlyRequest(req("/api/x")), false);
  assert.equal(isBearerOnlyRequest(req("/api/x", { headers: { authorization: "Bearer abc", cookie: "origin_access_token=t" } })), false);
  assert.equal(isBearerOnlyRequest(req("/api/x", { headers: { authorization: "Bearer abc", cookie: "origin_refresh_token=r" } })), false);
  // Unrelated cookies (analytics etc.) do not turn it into a browser session.
  assert.equal(isBearerOnlyRequest(req("/api/x", { headers: { authorization: "Bearer abc", cookie: "_ga=1" } })), true);
  assert.equal(isBearerOnlyRequest(req("/api/x", { headers: { authorization: "Basic abc" } })), false);
});

test("a bearer token plus its fingerprint header verifies; a wrong fingerprint does not", async () => {
  const issued = await issueAccessTokenForUser(user(), "sess1");
  const ok = req("/api/mobile/push-tokens", {
    headers: { authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: issued.accessFingerprint },
  });
  const claims = await verifyRequestAccessJwt(ok);
  assert.equal(claims.sub, "user_app_1");

  const wrong = req("/api/mobile/push-tokens", {
    headers: { authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: "not-the-fingerprint" },
  });
  await assert.rejects(() => verifyRequestAccessJwt(wrong));

  const missing = req("/api/mobile/push-tokens", { headers: { authorization: `Bearer ${issued.accessToken}` } });
  await assert.rejects(() => verifyRequestAccessJwt(missing));
});

test("middleware: bearer-only POST skips CSRF and reaches the handler with the user id", async () => {
  const issued = await issueAccessTokenForUser(user(), "sess2");
  const response = await middleware(
    req("/api/mobile/push-tokens", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: issued.accessFingerprint },
    }),
  );
  assert.notEqual(response.status, 403);
  assert.equal(response.headers.get("x-middleware-request-x-origin-user-id"), "user_app_1");
});

test("middleware: a cookie session still needs the CSRF token, even with a bearer header", async () => {
  const issued = await issueAccessTokenForUser(user(), "sess3");
  const response = await middleware(
    req("/api/mobile/push-tokens", {
      method: "POST",
      headers: {
        authorization: `Bearer ${issued.accessToken}`,
        cookie: `origin_access_token=${issued.accessToken}; origin_access_fgp=${issued.accessFingerprint}`,
      },
    }),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json().then((b: { detail: string }) => b.detail), "Invalid CSRF token.");
});

test("middleware: bearer POST with a bad fingerprint is rejected as unauthenticated", async () => {
  const issued = await issueAccessTokenForUser(user(), "sess4");
  const response = await middleware(
    req("/api/mobile/push-tokens", {
      method: "POST",
      headers: { authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: "forged" },
    }),
  );
  assert.equal(response.status, 401);
});

test("middleware: app auth endpoints are public and CSRF-exempt", async () => {
  const response = await middleware(req("/api/mobile/auth/login", { method: "POST" }));
  assert.notEqual(response.status, 403);
  assert.notEqual(response.status, 401);
});

test("route policy: /api/mobile/auth/* is public, the rest of /api/mobile stays authenticated", () => {
  for (const path of ["/api/mobile/auth/login", "/api/mobile/auth/refresh", "/api/mobile/auth/otp/verify"]) {
    assert.equal(getApiRoutePolicy(path).kind, "public", path);
  }
  assert.equal(getApiRoutePolicy("/api/mobile/push-tokens").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/mobile/link-out").kind, "authenticated");
  // Prefix match is segment-based: a lookalike path is not public.
  assert.equal(getApiRoutePolicy("/api/mobile/authx").kind, "authenticated");
});

test("browser guard: Origin or Sec-Fetch-Site marks a browser request", () => {
  assert.equal(isBrowserRequest(req("/api/mobile/auth/login", { headers: { origin: "https://evil.example" } })), true);
  assert.equal(isBrowserRequest(req("/api/mobile/auth/login", { headers: { "sec-fetch-site": "same-origin" } })), true);
  assert.equal(isBrowserRequest(req("/api/mobile/auth/login", { headers: { "user-agent": "OriginApp/20000" } })), false);
});

test("app auth refuses browser requests before touching anything", async () => {
  const response = await handleAppAuth(
    req("/api/mobile/auth/login", { method: "POST", headers: { origin: "https://www.o3origin.com" } }),
    ["login"],
  );
  assert.equal(response.status, 403);
});

test("app auth: unknown path is 404, refresh without a token is 400", async () => {
  assert.equal((await handleAppAuth(req("/api/mobile/auth/nope", { method: "POST" }), ["nope"])).status, 404);
  const refresh = await handleAppAuth(
    new NextRequest(new URL("/api/mobile/auth/refresh", "https://www.o3origin.com"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    ["refresh"],
  );
  assert.equal(refresh.status, 400);
});

test("toAppTokens maps handler output to the app shape and passes errors through", async () => {
  const okResponse = await toAppTokens(
    Response.json({ user: { id: "u1" }, access: "a.b.c", refresh: "rt_x_y", accessFingerprint: "fgp" }, { status: 200 }),
  );
  const body = (await okResponse.json()) as Record<string, unknown>;
  assert.equal(body.accessToken, "a.b.c");
  assert.equal(body.refreshToken, "rt_x_y");
  assert.equal(body.accessFingerprint, "fgp");
  assert.deepEqual(body.user, { id: "u1" });
  assert.ok(typeof body.accessTokenExpiresAt === "string");
  assert.equal("access" in body, false);

  const denied = await toAppTokens(Response.json({ detail: "Invalid credentials." }, { status: 401 }));
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), { detail: "Invalid credentials." });

  const google = await toAppTokens(Response.json({ detail: "No account", needs_signup: true, email: "a@b.c", name: "A" }, { status: 404 }));
  assert.deepEqual(await google.json(), { detail: "No account", needsGoogleSignup: true, email: "a@b.c", name: "A" });
});

test("mobile config exposes only the student-facing flag allowlist", async () => {
  const { buildMobileConfig } = await import("../src/server/mobile/config");
  const flags = buildMobileConfig().flags;
  for (const key of ["contest", "payments", "originNow", "liveRooms", "teacherConnect", "batchHub", "studyMaterials"]) {
    assert.equal(typeof flags[key], "boolean", key);
  }
  // Admin/internal switches never leak into this public, CDN-cached response.
  for (const key of ["adminPricing", "adminSubAdmins", "teacherCodeApproval", "cbtModule"]) {
    assert.equal(key in flags, false, key);
  }
});

test("mobile config hands the app the web Google client id (empty when unset)", async () => {
  const { buildMobileConfig } = await import("../src/server/mobile/config");
  const previous = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  try {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    assert.equal(buildMobileConfig().googleWebClientId, "");
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = " web-client.apps.googleusercontent.com ";
    assert.equal(buildMobileConfig().googleWebClientId, "web-client.apps.googleusercontent.com");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    else process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = previous;
  }
});

function postJson(path: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(path, "https://www.o3origin.com"), {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "OriginApp/20000", ...headers },
    body: JSON.stringify(body),
  });
}

test("full app session: login → bearer call → refresh → logout → old refresh is dead", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const { resetStore } = await import("../src/server/store");
    resetStore();
    const student = { id: "user_student_demo", email: "student@origin.test" };

    // 1. Login returns tokens in the body (no cookies).
    const login = await handleAppAuth(postJson("/api/mobile/auth/login", { email: student.email, password: "password123" }), ["login"]);
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("set-cookie"), null);
    const tokens = (await login.json()) as { accessToken: string; accessFingerprint: string; refreshToken: string; user: { id: string } };
    assert.equal(tokens.user.id, student.id);
    assert.ok(tokens.refreshToken.startsWith("rt_"));
    // App sessions get the until-sign-out lifetime, like the Android shell.
    const { readStoreAsync } = await import("../src/server/store");
    const session = (await readStoreAsync()).authSessions.at(-1)!;
    assert.equal(session.clientKind, "android");

    // 2. The tokens authenticate a mutating API call through the middleware, no CSRF.
    const call = await middleware(
      req("/api/mobile/push-tokens", {
        method: "POST",
        headers: { authorization: `Bearer ${tokens.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: tokens.accessFingerprint },
      }),
    );
    assert.equal(call.headers.get("x-middleware-request-x-origin-user-id"), student.id);

    // 3. Refresh rotates the refresh token.
    const refresh = await handleAppAuth(postJson("/api/mobile/auth/refresh", { refreshToken: tokens.refreshToken }), ["refresh"]);
    assert.equal(refresh.status, 200);
    const rotated = (await refresh.json()) as { accessToken: string; refreshToken?: string };
    assert.ok(rotated.accessToken);

    // 4. Logout revokes the session; refreshing with it now fails.
    const current = rotated.refreshToken ?? tokens.refreshToken;
    const logout = await handleAppAuth(postJson("/api/mobile/auth/logout", { refreshToken: current }), ["logout"]);
    assert.equal(logout.status, 200);
    const dead = await handleAppAuth(postJson("/api/mobile/auth/refresh", { refreshToken: current }), ["refresh"]);
    assert.equal(dead.status, 401);

    // 5. Wrong password fails like on the web (the handler answers 400), still no cookies.
    const bad = await handleAppAuth(postJson("/api/mobile/auth/login", { email: student.email, password: "nope" }), ["login"]);
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { detail: "Invalid email or password." });
    assert.equal(bad.headers.get("set-cookie"), null);
  } finally {
    if (previousDatabaseUrl) process.env.USER_DATABASE_URL = previousDatabaseUrl;
  }
});

test("app password login uses the website lockout: wrong guesses lock the account on that network", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const { resetStore } = await import("../src/server/store");
    const { LOGIN_LOCKED_MESSAGE } = await import("../src/server/auth-login-gate");
    resetStore();
    const email = "student@origin.test";
    const from = (ip: string, password: string) =>
      handleAppAuth(postJson("/api/mobile/auth/login", { email, password }, { "x-forwarded-for": ip }), ["login"]);

    // 8 wrong passwords from one network (loginFailureLimiter: 8 per 15 min)…
    for (let i = 0; i < 8; i += 1) assert.equal((await from("203.0.113.7", `wrong-${i}`)).status, 400);
    // …lock that account there, even with the right password: the gate runs first.
    const locked = await from("203.0.113.7", "password123");
    assert.equal(locked.status, 429);
    assert.deepEqual(await locked.json(), { detail: LOGIN_LOCKED_MESSAGE });
    // The owner on another network is not locked out by a stranger's guesses.
    assert.equal((await from("198.51.100.20", "password123")).status, 200);
  } finally {
    if (previousDatabaseUrl) process.env.USER_DATABASE_URL = previousDatabaseUrl;
  }
});

test("server actions see bearer credentials: getAuthenticatedUser resolves the app user", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const { buildCredentialRequest } = await import("../src/lib/auth-server");
    const { getAuthenticatedUser } = await import("../src/server/authz");
    const { readStoreAsync, resetStore } = await import("../src/server/store");
    resetStore();
    const student = (await readStoreAsync()).users.find((u) => u.id === "user_student_demo")!;
    const issued = await issueAccessTokenForUser(student, "sess-actions");

    const bearer = new Headers({ authorization: `Bearer ${issued.accessToken}`, [ACCESS_FINGERPRINT_HEADER]: issued.accessFingerprint });
    const resolved = await getAuthenticatedUser(buildCredentialRequest("", bearer));
    assert.equal(resolved?.id, "user_student_demo");

    // Without a bearer token the fingerprint header is not forwarded at all.
    const noBearer = buildCredentialRequest("", new Headers({ [ACCESS_FINGERPRINT_HEADER]: issued.accessFingerprint }));
    assert.equal(noBearer.headers.get(ACCESS_FINGERPRINT_HEADER), null);
    assert.equal(await getAuthenticatedUser(noBearer), null);

    // Browser path unchanged: cookies are forwarded as before.
    const cookie = buildCredentialRequest("origin_access_token=x", new Headers());
    assert.equal(cookie.headers.get("cookie"), "origin_access_token=x");
  } finally {
    if (previousDatabaseUrl) process.env.USER_DATABASE_URL = previousDatabaseUrl;
  }
});

test("app API: unknown routes fall through, bad input is a 400 before any action runs", async () => {
  const { handleAppApi } = await import("../src/server/mobile/app-api");
  assert.equal(await handleAppApi("GET", req("/api/mobile/nope"), ["nope"]), null);
  const badKind = await handleAppApi(
    "POST",
    new NextRequest(new URL("/api/mobile/ogcode/q1/reveal", "https://www.o3origin.com"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "everything" }),
    }),
    ["ogcode", "q1", "reveal"],
  );
  assert.equal(badKind?.status, 400);
  const badReason = await handleAppApi(
    "POST",
    new NextRequest(new URL("/api/mobile/ogcode/q1/report", "https://www.o3origin.com"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "i_dont_like_it" }),
    }),
    ["ogcode", "q1", "report"],
  );
  assert.equal(badReason?.status, 400);
  assert.match(String((await badReason?.json())?.detail), /incorrect_answer/);
});

test("app sign-in role: student by default, teacher on request, anything else refused first", async () => {
  const previousDatabaseUrl = process.env.USER_DATABASE_URL;
  delete process.env.USER_DATABASE_URL;
  try {
    const { resetStore } = await import("../src/server/store");
    resetStore();
    // A refused role never reaches the password check (no account is looked up).
    for (const role of ["admin", "cbt_teacher", "Teacher", 1]) {
      const refused = await handleAppAuth(postJson("/api/mobile/auth/login", { email: "teacher@origin.test", password: "password123", role }), ["login"]);
      assert.equal(refused.status, 400, `role ${String(role)}`);
    }
    const teacher = await handleAppAuth(postJson("/api/mobile/auth/login", { email: "teacher@origin.test", password: "password123", role: "teacher" }), ["login"]);
    assert.equal(teacher.status, 200);
    assert.equal(((await teacher.json()) as { user: { role: string } }).user.role, "teacher");
    // Without a role it's a student sign-in: the teacher account doesn't match.
    const asStudent = await handleAppAuth(postJson("/api/mobile/auth/login", { email: "teacher@origin.test", password: "password123" }), ["login"]);
    assert.notEqual(asStudent.status, 200);
    // The remote switch turns teacher sign-in off.
    process.env.MOBILE_TEACHER_ENABLED = "false";
    const off = await handleAppAuth(postJson("/api/mobile/auth/login", { email: "teacher@origin.test", password: "password123", role: "teacher" }), ["login"]);
    assert.equal(off.status, 400);
  } finally {
    delete process.env.MOBILE_TEACHER_ENABLED;
    if (previousDatabaseUrl) process.env.USER_DATABASE_URL = previousDatabaseUrl;
  }
});

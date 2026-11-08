/**
 * Google credential verification (BUG_FIX_PLAN.md A1). The load-bearing case:
 * an access token minted for ANOTHER app's OAuth client — which the old
 * userinfo-only check accepted — is now rejected, because Google's tokeninfo
 * reports an `aud` / `azp` that is not one of ours.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { googleAllowedAudiences, resolveGoogleCredential } from "@/server/google-credential";

const WEB_ID = "web-client.apps.googleusercontent.com";
const ANDROID_ID = "android-client.apps.googleusercontent.com";
const env = { NEXT_PUBLIC_GOOGLE_CLIENT_ID: WEB_ID, GOOGLE_ANDROID_CLIENT_ID: ANDROID_ID };

type Json = Record<string, unknown>;

/** A fetch stub that answers tokeninfo and userinfo from fixed payloads and records calls. */
function fakeFetch(tokeninfo: Json | null, userinfo: Json = { name: "Asha", picture: "https://img/asha.png" }) {
  const calls: string[] = [];
  const stub = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
      if (!tokeninfo) return new Response("{}", { status: 400 });
      return new Response(JSON.stringify(tokeninfo), { status: 200 });
    }
    if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
      return new Response(JSON.stringify(userinfo), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  return { stub, calls };
}

const goodToken = { aud: WEB_ID, azp: WEB_ID, email: "asha@example.com", email_verified: "true", expires_in: "3000" };

test("googleAllowedAudiences drops the placeholder and blanks", () => {
  assert.deepEqual(googleAllowedAudiences(env), [WEB_ID, ANDROID_ID]);
  assert.deepEqual(googleAllowedAudiences({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID" }), []);
  assert.deepEqual(googleAllowedAudiences({ NEXT_PUBLIC_GOOGLE_CLIENT_ID: "  " }), []);
});

test("access token minted for a foreign client is rejected", async () => {
  const { stub, calls } = fakeFetch({ ...goodToken, aud: "evil.apps.googleusercontent.com", azp: "evil.apps.googleusercontent.com" });
  const identity = await resolveGoogleCredential("ya29.foreign", { fetch: stub, env });
  assert.equal(identity, null);
  // userinfo is never consulted for a token that failed the audience check
  assert.equal(calls.filter((u) => u.includes("userinfo")).length, 0);
});

test("access token minted for our web client resolves to the verified email + profile", async () => {
  const { stub } = fakeFetch(goodToken);
  const identity = await resolveGoogleCredential("ya29.ours", { fetch: stub, env });
  assert.deepEqual(identity, { email: "asha@example.com", name: "Asha", avatar: "https://img/asha.png" });
});

test("azp = android client id is accepted even when aud differs", async () => {
  const { stub } = fakeFetch({ ...goodToken, aud: "something-else", azp: ANDROID_ID });
  const identity = await resolveGoogleCredential("ya29.android", { fetch: stub, env });
  assert.equal(identity?.email, "asha@example.com");
});

test("unverified email, expired token, missing email → rejected", async () => {
  for (const bad of [
    { ...goodToken, email_verified: "false" },
    { ...goodToken, expires_in: "0" },
    { ...goodToken, email: undefined },
  ]) {
    const { stub } = fakeFetch(bad as Json);
    assert.equal(await resolveGoogleCredential("ya29.bad", { fetch: stub, env }), null);
  }
});

test("tokeninfo 4xx (invalid / revoked token) → rejected", async () => {
  const { stub } = fakeFetch(null);
  assert.equal(await resolveGoogleCredential("ya29.revoked", { fetch: stub, env }), null);
});

test("userinfo failure does not block a login that passed the audience check", async () => {
  const calls: string[] = [];
  const stub = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("tokeninfo")) return new Response(JSON.stringify(goodToken), { status: 200 });
    return new Response("boom", { status: 500 });
  }) as typeof fetch;
  const identity = await resolveGoogleCredential("ya29.ours", { fetch: stub, env });
  assert.deepEqual(identity, { email: "asha@example.com", name: "Google User", avatar: null });
});

test("a JWT is only ever verified as an ID token: a bad one is NOT retried as an access token", async () => {
  const { stub, calls } = fakeFetch(goodToken);
  const identity = await resolveGoogleCredential("aaa.bbb.ccc", {
    fetch: stub,
    env,
    verifyIdToken: async () => { throw new Error("Wrong recipient, payload audience != requiredAudience"); },
  });
  assert.equal(identity, null);
  assert.deepEqual(calls, []);
});

test("a valid ID token resolves without touching the network", async () => {
  const { stub, calls } = fakeFetch(goodToken);
  const identity = await resolveGoogleCredential("aaa.bbb.ccc", {
    fetch: stub,
    env,
    verifyIdToken: async (_token, audiences) => {
      assert.deepEqual(audiences, [WEB_ID, ANDROID_ID]);
      return { email: "ravi@example.com", email_verified: "true", name: "Ravi", picture: undefined };
    },
  });
  assert.deepEqual(identity, { email: "ravi@example.com", name: "Ravi", avatar: null });
  assert.deepEqual(calls, []);
});

test("an ID token without a verified email is rejected", async () => {
  const identity = await resolveGoogleCredential("aaa.bbb.ccc", {
    env,
    verifyIdToken: async () => ({ email: "x@example.com", email_verified: "false" }),
  });
  assert.equal(identity, null);
});

test("no client id configured → every credential is refused", async () => {
  const { stub, calls } = fakeFetch(goodToken);
  assert.equal(await resolveGoogleCredential("ya29.ours", { fetch: stub, env: {} }), null);
  assert.deepEqual(calls, []);
});

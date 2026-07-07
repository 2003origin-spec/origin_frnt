import test from "node:test";
import assert from "node:assert/strict";

import { mutateJson } from "../src/lib/csrf";

type FetchHandler = (url: string, init?: RequestInit) => Response;

// mutateJson reads document.cookie and calls the global fetch (both directly and
// transitively via attemptTokenRefresh). These stubs let us drive the refresh +
// retry self-heal without a browser.
function installStubs() {
  const originalFetch = globalThis.fetch;
  const hadDocument = "document" in globalThis;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const state = { cookie: "" };
  const calls: { url: string; init?: RequestInit }[] = [];

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return state.cookie;
      },
      set cookie(value: string) {
        state.cookie = value;
      },
    },
  });

  return {
    calls,
    state,
    setFetch(handler: FetchHandler) {
      globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
        const url = typeof input === "string" ? input : String(input);
        calls.push({ url, init });
        return handler(url, init);
      }) as typeof fetch;
    },
    restore() {
      globalThis.fetch = originalFetch;
      if (hadDocument) {
        Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
      } else {
        delete (globalThis as { document?: unknown }).document;
      }
    },
  };
}

test("mutateJson refreshes the session when the CSRF cookie has lapsed, then sends the fresh token", async () => {
  const stubs = installStubs();
  try {
    stubs.state.cookie = ""; // access + CSRF cookies expired (10-min TTL)
    stubs.setFetch((url) => {
      if (url.includes("/users/token/refresh")) {
        // A successful refresh re-issues both the access and CSRF cookies.
        stubs.state.cookie = "origin_csrf=fresh-token";
        return new Response(null, { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const res = await mutateJson("/api/cbt/questions", { method: "POST", body: "{}" });

    assert.equal(res.status, 200);
    const refreshed = stubs.calls.some((c) => c.url.includes("/users/token/refresh"));
    assert.ok(refreshed, "should refresh the session before sending when the cookie is missing");
    const mutation = stubs.calls.find((c) => c.url === "/api/cbt/questions");
    assert.ok(mutation, "mutation request should be sent");
    const headers = new Headers(mutation!.init?.headers);
    assert.equal(headers.get("x-csrf-token"), "fresh-token", "the freshly issued token must be attached");
  } finally {
    stubs.restore();
  }
});

test("mutateJson retries once after a 403 by refreshing the session", async () => {
  const stubs = installStubs();
  try {
    stubs.state.cookie = "origin_csrf=stale";
    let mutationAttempts = 0;
    stubs.setFetch((url) => {
      if (url.includes("/users/token/refresh")) {
        stubs.state.cookie = "origin_csrf=rotated";
        return new Response(null, { status: 200 });
      }
      mutationAttempts += 1;
      return new Response(JSON.stringify({}), { status: mutationAttempts === 1 ? 403 : 200 });
    });

    const res = await mutateJson("/api/cbt/tests", { method: "POST", body: "{}" });

    assert.equal(res.status, 200);
    assert.equal(mutationAttempts, 2, "should retry the mutation once after a refresh");
  } finally {
    stubs.restore();
  }
});

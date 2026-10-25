/**
 * Shared `next=` validator (bug-fix spec 01-auth.md §A5). The load-bearing
 * case: `/\evil.com` — WHATWG URL treats `\` as `/`, so the old
 * `startsWith("/") && !startsWith("//")` checks let it resolve off-site.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { NextRequest } from "next/server";

import { isSafeAppNext, safeNext } from "@/lib/safe-next";

const REJECTED: Array<[string, string | null | undefined]> = [
  ["backslash after slash", "/\\evil.com"],
  ["double backslash", "/\\\\evil.com"],
  ["protocol-relative", "//evil.com"],
  ["encoded backslash", "/%5Cevil.com"],
  ["encoded backslash (lowercase)", "/%5cevil.com"],
  ["absolute URL", "https://evil.com"],
  ["javascript: URL", "javascript:alert(1)"],
  ["no leading slash", "dashboard"],
  ["NUL prefix", "\u0000/x"],
  ["tab inside", "/\t/evil.com"],
  ["newline inside", "/dash\nboard"],
  ["DEL char", "/dash\u007fboard"],
  ["API path", "/api/users/me"],
  ["API root", "/api"],
  ["refresh loop", "/auth/refresh?next=/x"],
  ["login page loop", "/auth"],
  ["build assets", "/_next/static/chunk.js"],
  ["dot-dot segment", "/..//evil"],
  ["dot-dot mid-path", "/dashboard/../api/x"],
  ["empty", ""],
  ["null", null],
  ["undefined", undefined],
  ["over-long", `/${"a".repeat(2100)}`],
];

for (const [label, value] of REJECTED) {
  test(`safeNext rejects ${label}`, () => {
    assert.equal(safeNext(value), "/dashboard");
    assert.equal(safeNext(value, "/teacher"), "/teacher");
    assert.equal(isSafeAppNext(value), false);
  });
}

test("safeNext keeps ordinary same-origin paths with search and hash", () => {
  assert.equal(safeNext("/dashboard?x=1"), "/dashboard?x=1");
  assert.equal(safeNext("/dashboard?tab=1#h"), "/dashboard?tab=1#h");
  assert.equal(safeNext("/premium"), "/premium");
  assert.equal(safeNext("/auth/handoff?token=abc"), "/auth/handoff?token=abc");
  assert.equal(safeNext("/admin/users"), "/admin/users");
});

test("isSafeAppNext accepts only already-normalised safe paths", () => {
  assert.equal(isSafeAppNext("/dashboard?x=1"), true);
  assert.equal(isSafeAppNext("/teacher"), true);
  assert.equal(isSafeAppNext("/\\evil.com"), false);
  // Normalisation changes it (space → %20), so it is not "already safe".
  assert.equal(isSafeAppNext("/a b"), false);
});

test("safe paths never resolve off-origin against a real base", () => {
  for (const [, value] of REJECTED) {
    const resolved = new URL(safeNext(value), "https://www.o3origin.com");
    assert.equal(resolved.origin, "https://www.o3origin.com", String(value));
  }
});

test("GET /auth/refresh?next=/\\evil.com without a cookie lands on /auth?next=/dashboard on this host", async () => {
  const { GET } = await import("@/app/auth/refresh/route");
  const url = new URL("https://www.o3origin.com/auth/refresh");
  url.searchParams.set("next", "/\\evil.com");
  const response = await GET(new NextRequest(url));
  const location = new URL(response.headers.get("location") ?? "", "https://www.o3origin.com");
  assert.equal(location.origin, "https://www.o3origin.com");
  assert.equal(location.pathname, "/auth");
  assert.equal(location.searchParams.get("next"), "/dashboard");
});

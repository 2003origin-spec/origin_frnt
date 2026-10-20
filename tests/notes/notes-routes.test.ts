import test from "node:test";
import assert from "node:assert/strict";

import { getApiRoutePolicy, getAppRoutePolicy } from "../../src/server/route-policy";
import { findRoute, matchSegments, type NotesRoute } from "../../src/server/notes/notes-routes";

test("Notes routes have an explicit policy (unknown routes are denied by default)", () => {
  assert.equal(getAppRoutePolicy("/notes").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/notes/library/home").kind, "authenticated");
  assert.equal(getApiRoutePolicy("/api/admin/notes/tree").kind, "authenticated");
  assert.equal(getAppRoutePolicy("/admin/notes").kind, "role");
});

test("segment matching captures ids and refuses odd ones", () => {
  assert.deepEqual(matchSegments(["library", "items", ":id"], ["library", "items", "nitem_abc123"]), { id: "nitem_abc123" });
  assert.equal(matchSegments(["library", "items", ":id"], ["library", "items"]), null);
  assert.equal(matchSegments(["library", "items", ":id"], ["library", "items", "../etc"]), null);
  assert.equal(matchSegments(["library", "home"], ["library", "homes"]), null);
});

test("method mismatch is told apart from not found", () => {
  const routes: NotesRoute<string>[] = [
    { method: "GET", pattern: ["a", ":id"], handler: "get" },
    { method: "POST", pattern: ["a", ":id", "star"], handler: "star" },
  ];
  const hit = findRoute(routes, "GET", ["a", "x1"]);
  assert.ok(hit.route);
  assert.equal(hit.route.handler, "get");
  const wrongMethod = findRoute(routes, "DELETE", ["a", "x1"]);
  assert.equal(wrongMethod.route, null);
  assert.equal("methodMismatch" in wrongMethod && wrongMethod.methodMismatch, true);
  const missing = findRoute(routes, "GET", ["b"]);
  assert.equal("methodMismatch" in missing && missing.methodMismatch, false);
});

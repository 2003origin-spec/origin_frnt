/**
 * Bug U3 — the Next → origin-ai proxy header allowlist.
 *
 * `buildOriginAiServiceHeaders` is the only place a client header can reach the
 * Python service. The client's Authorization / Cookie / X-Origin-User-* must
 * never cross (Python authenticates the *service*, and trusts whatever user
 * Next resolved from the session); the service bearer is set last so neither
 * a forwarded header nor an `extra` entry can override it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOriginAiServiceHeaders,
  FORWARDED_CLIENT_HEADERS,
  type ProxyHeaderUser,
} from "../../src/server/origin-ai-proxy-headers";

const SERVICE_TOKEN = "service-secret-token";
const REQUEST_ID = "req_test_123";

const user: ProxyHeaderUser = {
  id: "user_real_1",
  name: "Asha",
  email: "asha@example.com",
  role: "student",
  streak: 4,
  studentClass: "12",
  selectedCourse: "jee",
};

function build(incoming: Record<string, string>, extra?: Record<string, string>): Headers {
  return buildOriginAiServiceHeaders(new Headers(incoming), user, SERVICE_TOKEN, REQUEST_ID, "jee", extra);
}

test("client Authorization never replaces the service bearer", () => {
  const headers = build({ authorization: "Bearer evil-client-token" });
  assert.equal(headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
});

test("client Cookie is never forwarded", () => {
  const headers = build({ cookie: "access=stolen; refresh=stolen" });
  assert.equal(headers.get("cookie"), null);
});

test("client X-Origin-User-* headers cannot impersonate another student", () => {
  const headers = build({
    "x-origin-user-id": "user_victim_9",
    "x-origin-user-role": "admin",
    "x-origin-user-email": "victim@example.com",
  });
  assert.equal(headers.get("x-origin-user-id"), user.id);
  assert.equal(headers.get("x-origin-user-role"), "student");
  assert.equal(headers.get("x-origin-user-email"), user.email);
});

test("unlisted client headers (X-Forwarded-*, Host, custom) stop at the proxy", () => {
  const headers = build({
    "x-forwarded-for": "10.0.0.1",
    "x-forwarded-host": "evil.example",
    host: "evil.example",
    "x-custom-anything": "nope",
  });
  for (const name of ["x-forwarded-for", "x-forwarded-host", "host", "x-custom-anything"]) {
    assert.equal(headers.get(name), null, `${name} must not be forwarded`);
  }
});

test("only the allowlisted client headers are forwarded", () => {
  const headers = build({
    "x-origin-ai-session-id": "sess_abc",
    "accept-language": "hi-IN,en;q=0.8",
  });
  assert.deepEqual([...FORWARDED_CLIENT_HEADERS].sort(), ["accept-language", "x-origin-ai-session-id"]);
  assert.equal(headers.get("x-origin-ai-session-id"), "sess_abc");
  assert.equal(headers.get("accept-language"), "hi-IN,en;q=0.8");
});

test("service bearer is set last: an `extra` Authorization cannot override it", () => {
  const headers = build({}, { Authorization: "Bearer from-extra", Accept: "text/event-stream" });
  assert.equal(headers.get("authorization"), `Bearer ${SERVICE_TOKEN}`);
  assert.equal(headers.get("accept"), "text/event-stream");
});

test("a forwarded client header cannot override the identity or request id", () => {
  // The forwarded set is a fixed allowlist; even if a client sends a header with
  // the same name as an identity header it is simply not copied.
  const headers = build({ "x-request-id": "forged", "content-type": "text/plain" });
  assert.equal(headers.get("x-request-id"), REQUEST_ID);
  assert.equal(headers.get("content-type"), "application/json");
});

test("the resolved user and study mode are what Python sees", () => {
  const headers = build({});
  assert.equal(headers.get("x-origin-user-id"), user.id);
  assert.equal(headers.get("x-origin-user-name"), "Asha");
  assert.equal(headers.get("x-origin-user-streak"), "4");
  assert.equal(headers.get("x-origin-user-student-class"), "12");
  assert.equal(headers.get("x-origin-user-selected-course"), "jee");
  assert.equal(headers.get("x-origin-user-study-mode"), "jee");
  assert.ok((headers.get("x-origin-user-mode-subjects") ?? "").length > 0, "mode subjects populated");
});

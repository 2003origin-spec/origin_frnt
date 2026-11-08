/**
 * Bug U2 — origin-ai voice WebSocket ticket.
 *
 * Covers the TypeScript minter/verifier pair in src/server/origin-ai-ws-ticket.ts.
 * The Python verifier (origin-ai/app/auth/ws_ticket.py) implements the same
 * algorithm; the fixture ticket below is also checked there so the two sides
 * cannot drift silently.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  mintOriginAiWsTicket,
  verifyOriginAiWsTicket,
  WS_TICKET_TTL_SECONDS,
} from "../../src/server/origin-ai-ws-ticket";

const SECRET = "origin-ai-test-secret";
const NOW = 1_800_000_000_000; // ms

test("mint → verify roundtrip returns the same user id", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW, secret: SECRET }), "user_42");
});

test("ticket shape is v1.<b64url uid>.<exp>.<nonce>.<sig> with a 60 s TTL", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  const parts = minted.ticket.split(".");
  assert.equal(parts.length, 5);
  assert.equal(parts[0], "v1");
  assert.equal(Buffer.from(parts[1], "base64url").toString("utf8"), "user_42");
  assert.equal(Number(parts[2]), Math.floor(NOW / 1000) + WS_TICKET_TTL_SECONDS);
  assert.equal(minted.expiresAt, Math.floor(NOW / 1000) + WS_TICKET_TTL_SECONDS);
  assert.equal(minted.expiresInSeconds, 60);
  assert.match(parts[3], /^[0-9a-f]{16}$/);
  assert.match(parts[4], /^[0-9a-f]{64}$/);
});

test("signature is HMAC(HMAC(secret, label), uid|exp|nonce) — matches the Python verifier", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  const [, , exp, nonce, sig] = minted.ticket.split(".");
  const key = createHmac("sha256", SECRET).update("origin-ai:ws-ticket:v1").digest();
  const expected = createHmac("sha256", key).update(`user_42|${exp}|${nonce}`).digest("hex");
  assert.equal(sig, expected);
});

test("verifies the shared cross-language fixture (also pinned in origin-ai/tests/test_ws_ticket.py)", () => {
  const fixture =
    "v1.dXNlcl80Mg.1800000060.0123456789abcdef." +
    "fb7581de7831ba7c06e61103941542a909ccf8c427271b962432e329d09f05b8";
  assert.equal(verifyOriginAiWsTicket(fixture, { now: NOW, secret: SECRET }), "user_42");
});

test("different users and different nonces produce different signatures", () => {
  const a = mintOriginAiWsTicket("user_a", { now: NOW, secret: SECRET });
  const b = mintOriginAiWsTicket("user_b", { now: NOW, secret: SECRET });
  const a2 = mintOriginAiWsTicket("user_a", { now: NOW, secret: SECRET });
  assert.notEqual(a.ticket.split(".")[4], b.ticket.split(".")[4]);
  assert.notEqual(a.ticket, a2.ticket);
});

test("accepted right up to exp, rejected one second after", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  const expMs = minted.expiresAt * 1000;
  assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: expMs, secret: SECRET }), "user_42");
  assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: expMs + 1000, secret: SECRET }), null);
});

test("tampered user id, exp, nonce or signature is rejected", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  const [v, uid, exp, nonce, sig] = minted.ticket.split(".");
  const other = Buffer.from("victim_7", "utf8").toString("base64url");
  const flippedSig = (sig[0] === "0" ? "1" : "0") + sig.slice(1);
  const cases = [
    [v, other, exp, nonce, sig].join("."),
    [v, uid, String(Number(exp) + 3600), nonce, sig].join("."),
    [v, uid, exp, "0".repeat(16), sig].join("."),
    [v, uid, exp, nonce, flippedSig].join("."),
    ["v2", uid, exp, nonce, sig].join("."),
    [v, uid, exp, nonce].join("."),
    "",
  ];
  for (const bad of cases) {
    assert.equal(verifyOriginAiWsTicket(bad, { now: NOW, secret: SECRET }), null, bad);
  }
  assert.equal(verifyOriginAiWsTicket(null, { now: NOW, secret: SECRET }), null);
});

test("a ticket minted with one secret does not verify under another", () => {
  const minted = mintOriginAiWsTicket("user_42", { now: NOW, secret: SECRET });
  assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW, secret: "other-secret" }), null);
  assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW, secret: "" }), null);
});

test("minting requires a non-empty user id", () => {
  assert.throws(() => mintOriginAiWsTicket("  ", { now: NOW, secret: SECRET }));
});

test("falls back to ORIGIN_AI_SERVICE_TOKEN from the environment", () => {
  const previous = process.env.ORIGIN_AI_SERVICE_TOKEN;
  process.env.ORIGIN_AI_SERVICE_TOKEN = "env-secret";
  try {
    const minted = mintOriginAiWsTicket("user_env", { now: NOW });
    assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW }), "user_env");
    assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW, secret: SECRET }), null);
    delete process.env.ORIGIN_AI_SERVICE_TOKEN;
    assert.throws(() => mintOriginAiWsTicket("user_env", { now: NOW }));
    assert.equal(verifyOriginAiWsTicket(minted.ticket, { now: NOW }), null);
  } finally {
    if (previous === undefined) delete process.env.ORIGIN_AI_SERVICE_TOKEN;
    else process.env.ORIGIN_AI_SERVICE_TOKEN = previous;
  }
});

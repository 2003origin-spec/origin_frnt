/**
 * Login brute-force gate (BUG_FIX_PLAN.md A2). The load-bearing cases: after
 * the failure budget is spent, a request with the CORRECT password is refused
 * with 429 before any credential check runs; a 5xx never counts; the lockout
 * is scoped to the caller's network (plus a per-account backstop), OTP has its
 * own budget, and a password reset clears it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createMemoryLimiter } from "@/lib/rate-limit";
import {
  LOGIN_IP_LIMITED_MESSAGE,
  LOGIN_LOCKED_MESSAGE,
  createLoginGate,
  ipPrefix,
  loginAccountKey,
  otpLoginKey,
  shouldCountLoginFailure,
} from "@/server/auth-login-gate";

function gateWith(opts: { ip?: number; ipFail?: number; fail?: number; acctFail?: number } = {}) {
  return createLoginGate({
    ipLimiter: createMemoryLimiter(opts.ip ?? 1000, 60_000, { failClosed: true }),
    ipFailureLimiter: createMemoryLimiter(opts.ipFail ?? 1000, 60_000, { failClosed: true }),
    failureLimiter: createMemoryLimiter(opts.fail ?? 1000, 60_000, { failClosed: true }),
    accountFailureLimiter: createMemoryLimiter(opts.acctFail ?? 1000, 60_000, { failClosed: true }),
  });
}

const LOCKED = { ok: false, status: 429, message: LOGIN_LOCKED_MESSAGE };
const IP_LIMITED = { ok: false, status: 429, message: LOGIN_IP_LIMITED_MESSAGE };

test("account locks after N failures from one network; other networks and accounts are unaffected", async () => {
  const gate = gateWith({ fail: 3 });
  const key = loginAccountKey("Asha@Example.com");
  for (let i = 0; i < 3; i += 1) {
    assert.equal(await gate.gate("1.1.1.1", key), null);
    await gate.recordFailure("1.1.1.1", key);
  }
  assert.deepEqual(await gate.gate("1.1.1.1", key), LOCKED);
  // same /24 is the same network
  assert.deepEqual(await gate.gate("1.1.1.200", key), LOCKED);
  // a stranger guessing from elsewhere cannot lock the owner out of their own network
  assert.equal(await gate.gate("9.9.9.9", key), null);
  // a sibling account on the same IP still gets through
  assert.equal(await gate.gate("1.1.1.1", loginAccountKey("ravi@example.com")), null);
});

test("the per-account backstop locks the account from every network", async () => {
  const gate = gateWith({ fail: 100, acctFail: 4 });
  const key = loginAccountKey("asha@example.com");
  for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) await gate.recordFailure(ip, key);
  assert.deepEqual(await gate.gate("5.5.5.5", key), LOCKED);
});

test("the gate itself never consumes the failure budget", async () => {
  const gate = gateWith({ fail: 2, acctFail: 2, ipFail: 2 });
  const key = loginAccountKey("x@example.com");
  for (let i = 0; i < 10; i += 1) assert.equal(await gate.gate("1.1.1.1", key), null);
});

test("per-IP throughput cap trips on volume regardless of account", async () => {
  const gate = gateWith({ ip: 2 });
  assert.equal(await gate.gate("1.1.1.1", "pw:a"), null);
  assert.equal(await gate.gate("1.1.1.1", "pw:b"), null);
  assert.deepEqual(await gate.gate("1.1.1.1", "pw:c"), IP_LIMITED);
  assert.equal(await gate.gate("2.2.2.2", "pw:c"), null);
});

test("per-IP failure cap counts only failures, across accounts", async () => {
  const gate = gateWith({ ipFail: 3 });
  // many successful logins from one NAT address never trip it
  for (let i = 0; i < 20; i += 1) assert.equal(await gate.gate("1.1.1.1", `pw:s${i}`), null);
  for (const acct of ["pw:a", "pw:b", "pw:c"]) await gate.recordFailure("1.1.1.1", acct);
  assert.deepEqual(await gate.gate("1.1.1.1", "pw:d"), IP_LIMITED);
  assert.equal(await gate.gate("1.1.1.2", "pw:d"), null);
});

test("OTP login has its own budget: wrong passwords do not block the emailed code", async () => {
  const gate = gateWith({ fail: 2 });
  for (let i = 0; i < 2; i += 1) await gate.recordFailure("1.1.1.1", loginAccountKey("asha@example.com"));
  assert.deepEqual(await gate.gate("1.1.1.1", loginAccountKey("asha@example.com")), LOCKED);
  assert.equal(await gate.gate("1.1.1.1", otpLoginKey("asha@example.com")), null);
});

test("clearAccount (password reset) lifts the lockout", async () => {
  const gate = gateWith({ fail: 2, acctFail: 2 });
  const key = loginAccountKey("asha@example.com");
  await gate.recordFailure("1.1.1.1", key);
  await gate.recordFailure("1.1.1.1", key);
  assert.deepEqual(await gate.gate("1.1.1.1", key), LOCKED);
  await gate.clearAccount("1.1.1.1", key);
  assert.equal(await gate.gate("1.1.1.1", key), null);
});

test("shouldCountLoginFailure: 4xx counts, 5xx and needs-signup do not", () => {
  assert.equal(shouldCountLoginFailure({ ok: false, status: 401 }), true);
  assert.equal(shouldCountLoginFailure({ ok: false, status: 400 }), true);
  assert.equal(shouldCountLoginFailure({ ok: false, status: 503 }), false);
  assert.equal(shouldCountLoginFailure({ ok: false, status: 500 }), false);
  assert.equal(shouldCountLoginFailure({ ok: false, status: 404, needsGoogleSignup: true }), false);
  assert.equal(shouldCountLoginFailure({ ok: true, status: 200 }), false);
});

test("lockout keys ignore the client-supplied role and normalise the email", () => {
  assert.equal(loginAccountKey("  Asha@Example.com "), "pw:asha@example.com");
  assert.equal(otpLoginKey("Asha@Example.com"), "otp:asha@example.com");
  assert.equal(loginAccountKey(undefined), "pw:");
  assert.notEqual(loginAccountKey("a@b.c"), otpLoginKey("a@b.c"));
});

test("ipPrefix: /24 for IPv4 and IPv4-mapped, /48 for IPv6", () => {
  assert.equal(ipPrefix("203.0.113.77"), "203.0.113.0/24");
  assert.equal(ipPrefix("::ffff:203.0.113.77"), "203.0.113.0/24");
  assert.equal(ipPrefix("2001:db8:abcd:12::1"), "2001:db8:abcd::/48");
  assert.equal(ipPrefix("2001:DB8:ABCD:0012:0000:0000:0000:0001"), "2001:db8:abcd::/48");
  assert.equal(ipPrefix("2001:db8::1"), "2001:db8:0::/48");
  assert.equal(ipPrefix("[::1]"), "0:0:0::/48");
  assert.equal(ipPrefix("anonymous"), "anonymous");
});

test("Google sign-in spends no failure budget and ignores spent IP/account budgets", async () => {
  const gate = gateWith({ ipFail: 2, fail: 2, acctFail: 2 });
  for (let i = 0; i < 5; i += 1) await gate.recordFailure("1.1.1.1", "google:1.1.1.1", "google");
  // password logins from that IP are untouched by the rejected Google tokens
  assert.equal(await gate.gate("1.1.1.1", loginAccountKey("asha@example.com")), null);
  // and a password-spent IP failure budget never blocks Google sign-in
  for (const acct of ["pw:a", "pw:b"]) await gate.recordFailure("1.1.1.1", acct);
  assert.deepEqual(await gate.gate("1.1.1.1", "pw:z"), IP_LIMITED);
  assert.equal(await gate.gate("1.1.1.1", "google:1.1.1.1", "google"), null);
});

test("Google sign-in is still bound by per-IP throughput", async () => {
  const gate = gateWith({ ip: 1 });
  assert.equal(await gate.gate("1.1.1.1", "google:1.1.1.1", "google"), null);
  assert.deepEqual(await gate.gate("1.1.1.1", "google:1.1.1.1", "google"), IP_LIMITED);
});

test("OTP counts IP failures on its own key: a school's wrong passwords don't block OTP sign-in", async () => {
  const gate = gateWith({ ipFail: 2 });
  for (const acct of ["pw:a", "pw:b"]) await gate.recordFailure("1.1.1.1", acct);
  assert.deepEqual(await gate.gate("1.1.1.1", "pw:c"), IP_LIMITED);
  assert.equal(await gate.gate("1.1.1.1", otpLoginKey("c@example.com"), "otp"), null);
  for (const acct of ["otp:a", "otp:b"]) await gate.recordFailure("1.1.1.1", acct, "otp");
  assert.deepEqual(await gate.gate("1.1.1.1", otpLoginKey("c@example.com"), "otp"), IP_LIMITED);
});

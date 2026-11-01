/**
 * Student join codes are no longer cheaply enumerable.
 *
 * - New generated codes use an 8-character crypto.randomInt suffix (was 4
 *   characters from Math.random after the public display name ≈ 2^20).
 * - Every join-code surface charges a miss budget only on a miss. Join and
 *   redeem pre-check the per-USER budget fail-closed. Once the per-IP budget
 *   is spent, a user with no miss in the window still gets one lookup (a right
 *   code is accepted — round-2 F4: one student must not lock out a school),
 *   but a user who has already missed is refused before the lookup (round-3
 *   R3-4: a spent IP must not stay a right/wrong oracle across accounts).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CODE_SUFFIX_ALPHABET,
  CODE_SUFFIX_LENGTH,
  generateDefaultPersonalCode,
  randomCodeSuffix,
  validateCodeFormat,
} from "../../src/server/workspaces/codes";
import { checkFailureBudget, recordFailure, type FailureBudgetKey } from "../../src/lib/rate-limit";
import {
  checkJoinCodeBudget,
  isJoinCodeMiss,
  joinCodeFailureKeys,
  type JoinCodeFailureKeys,
} from "../../src/server/workspaces/join-code-guard";

test("generated suffix: ≥8 chars from the unambiguous alphabet, via crypto", () => {
  assert.ok(CODE_SUFFIX_LENGTH >= 8);
  assert.doesNotMatch(CODE_SUFFIX_ALPHABET, /[IO01]/);
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const s = randomCodeSuffix();
    assert.equal(s.length, CODE_SUFFIX_LENGTH);
    assert.match(s, new RegExp(`^[${CODE_SUFFIX_ALPHABET}]+$`));
    seen.add(s);
  }
  assert.equal(seen.size, 200, "suffixes should not repeat");

  const codes = readFileSync(new URL("../../src/server/workspaces/codes.ts", import.meta.url), "utf8");
  assert.match(codes, /randomInt\(CODE_SUFFIX_ALPHABET\.length\)/);
  assert.doesNotMatch(codes, /Math\.random\(\)/);
  // Default, fallback AND rotated codes all use the long suffix.
  assert.equal(codes.match(/randomCodeSuffix\(\)/g)?.length, 3);
  assert.doesNotMatch(codes, /randomSuffix\(/);
});

test("default codes carry the long suffix and stay valid (long names included)", () => {
  for (const name of ["Ms Sharma", "Sri Chaitanya Educational Institutions Hyderabad", ""]) {
    const { display, normalized } = generateDefaultPersonalCode(name);
    assert.equal(validateCodeFormat(display), normalized);
    const suffix = normalized.split("-").at(-1) ?? "";
    assert.equal(suffix.length, CODE_SUFFIX_LENGTH, normalized);
  }
});

/** A failure limiter with a fixed budget, modelled like Upstash's sliding window. */
function budget(limit: number, opts: { broken?: boolean } = {}) {
  const used = new Map<string, number>();
  return {
    used,
    limiter: {
      async limit(id: string) {
        if (opts.broken) throw new Error("redis down");
        const n = (used.get(id) ?? 0) + 1;
        used.set(id, n);
        return { success: n <= limit, limit, remaining: Math.max(0, limit - n), reset: Date.now() + 3_600_000 };
      },
      async remaining(id: string) {
        if (opts.broken) throw new Error("redis down");
        return Math.max(0, limit - (used.get(id) ?? 0));
      },
      async reset(id: string) {
        used.delete(id);
      },
      failClosed: true,
      max: limit,
    },
  };
}

test("failure budget: allowed until exhausted, then 429 — checking never charges", async () => {
  const user = budget(3);
  const ip = budget(5);
  const keys: FailureBudgetKey[] = [
    { limiter: user.limiter, identifier: "user:u1" },
    { limiter: ip.limiter, identifier: "ip:1.2.3.4" },
  ];
  for (let i = 0; i < 10; i++) assert.equal(await checkFailureBudget(keys), null);
  assert.equal(user.used.get("user:u1") ?? 0, 0, "a pre-check must not consume budget");

  await recordFailure(keys);
  await recordFailure(keys);
  assert.equal(await checkFailureBudget(keys), null);
  await recordFailure(keys);
  const blocked = await checkFailureBudget(keys);
  assert.equal(blocked?.status, 429);
  assert.ok(Number(blocked?.headers.get("Retry-After")) > 0);
  assert.equal(ip.used.get("ip:1.2.3.4"), 3, "every key is charged");
});

test("failure budget is fail-CLOSED on a backend error; charging is best-effort", async () => {
  const broken = budget(10, { broken: true });
  const keys = [{ limiter: broken.limiter, identifier: "user:u1" }];
  const blocked = await checkFailureBudget(keys);
  assert.equal(blocked?.status, 429);
  await assert.doesNotReject(recordFailure(keys));
});

test("only 'no such code' (404) counts as a miss", () => {
  assert.equal(isJoinCodeMiss({ status: 404 }), true);
  for (const status of [400, 403, 409, 500]) assert.equal(isJoinCodeMiss({ status }), false);
  assert.equal(isJoinCodeMiss(null), false);
});

test("recordFailure returns 429 once a miss goes past any key's budget", async () => {
  const ip = budget(2);
  const keys: FailureBudgetKey[] = [{ limiter: ip.limiter, identifier: "ip:1.2.3.4" }];
  assert.equal(await recordFailure(keys), null);
  assert.equal(await recordFailure(keys), null);
  assert.equal((await recordFailure(keys))?.status, 429);
  // a backend error while charging never turns into a refusal
  assert.equal(await recordFailure([{ limiter: budget(1, { broken: true }).limiter, identifier: "x" }]), null);
});

test("join-code keys: per-user gate, per-user + per-IP charge, per-IP gate for users with a miss", () => {
  const req = new Request("https://x.test/api", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
  const { precheck, charge, ipGate } = joinCodeFailureKeys("u1", req);
  assert.deepEqual(precheck.map((k) => k.identifier), ["user:u1"]);
  assert.deepEqual(charge.map((k) => k.identifier), ["user:u1", "ip:9.9.9.9"]);
  assert.equal(ipGate.ip.identifier, "ip:9.9.9.9");
  assert.equal(ipGate.user.identifier, "user:u1");
  const rl = readFileSync(new URL("../../src/lib/rate-limit.ts", import.meta.url), "utf8");
  assert.match(rl, /joinCodeFailureLimiter = createLimiter\(10, /);
  assert.match(rl, /joinCodeFailureIpLimiter = createLimiter\(300, /);
});

test("join, redeem and code-check routes pre-check and charge the miss budget", () => {
  const read = (p: string) => readFileSync(new URL(`../../src/app/api/${p}`, import.meta.url), "utf8");
  for (const route of ["enrollments/join-code/route.ts", "connect/redeem-code/route.ts"]) {
    const src = read(route);
    assert.match(src, /joinCodeFailureKeys\(/, route);
    assert.ok(
      src.indexOf("checkJoinCodeBudget(failureKeys)") > 0 &&
        src.indexOf("checkJoinCodeBudget(failureKeys)") < src.indexOf("parseJsonBody("),
      `${route}: per-user + per-IP gate before lookup`,
    );
    assert.match(src, /const overBudget = await recordFailure\(failureKeys\.charge\);\s+if \(overBudget\) return overBudget;/, route);
  }
  const check = read("teacher/codes/check/route.ts");
  assert.match(check, /requireRole\(request, \["teacher", "admin"\]\)/);
  assert.match(check, /codeCheckFailureKeys\(/);
  assert.match(check, /if \(result\.available\) await recordFailure\(failureKeys\)/);
});

/** Simulates the join/redeem route: gate, lookup, charge on a miss. */
function joinKeys(userLimiter: FailureBudgetKey["limiter"], ipLimiter: FailureBudgetKey["limiter"], userId: string): JoinCodeFailureKeys {
  const user = { limiter: userLimiter, identifier: `user:${userId}` };
  const ip = { limiter: ipLimiter, identifier: "ip:1.2.3.4" };
  return { precheck: [user], charge: [user, ip], ipGate: { ip, user } };
}

async function attempt(keys: JoinCodeFailureKeys, right: boolean): Promise<number> {
  const gate = await checkJoinCodeBudget(keys);
  if (gate) return gate.status;
  if (right) return 200;
  const over = await recordFailure(keys.charge);
  return over ? over.status : 404;
}

test("R3-4: a spent IP refuses users who already missed, before the lookup — right code included", async () => {
  const user = budget(10);
  const ip = budget(3);
  const a = joinKeys(user.limiter, ip.limiter, "a");
  // Spend the IP budget with three wrong codes from user a.
  assert.deepEqual([await attempt(a, false), await attempt(a, false), await attempt(a, false)], [404, 404, 404]);
  // IP now spent; user a has misses: refused before the lookup, even for a RIGHT code (no oracle).
  const before = ip.used.get("ip:1.2.3.4");
  assert.equal(await attempt(a, true), 429);
  assert.equal(await attempt(a, false), 429);
  assert.equal(ip.used.get("ip:1.2.3.4"), before, "a gated attempt is not looked up or charged");
});

test("R3-4: on a spent IP a clean user's right code is still accepted; a wrong one costs their only guess", async () => {
  const user = budget(10);
  const ip = budget(1);
  assert.equal(await attempt(joinKeys(user.limiter, ip.limiter, "a"), false), 404); // spends the IP
  // A classmate behind the same NAT with no misses: the right code gets in.
  assert.equal(await attempt(joinKeys(user.limiter, ip.limiter, "b"), true), 200);
  // A fresh throwaway account gets exactly one wrong guess (429), then is gated.
  const c = joinKeys(user.limiter, ip.limiter, "c");
  assert.equal(await attempt(c, false), 429);
  assert.equal(await attempt(c, true), 429);
});

test("R3-4: the per-IP gate is fail-closed when the user's miss count can't be read", async () => {
  const ip = budget(1);
  const okUser = budget(10);
  const keys = joinKeys(okUser.limiter, ip.limiter, "a");
  await recordFailure(keys.charge); // spend IP
  // The user-miss read inside the IP gate errors (the per-user precheck itself still reads fine).
  const brokenUser = { ...okUser.limiter, remaining: async () => Promise.reject(new Error("redis down")) };
  const gated = await checkJoinCodeBudget({ ...keys, ipGate: { ip: keys.ipGate.ip, user: { limiter: brokenUser, identifier: "user:a" } } });
  assert.equal(gated?.status, 429);
});

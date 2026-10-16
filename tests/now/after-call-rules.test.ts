import test from "node:test";
import assert from "node:assert/strict";

import {
  REPORT_WINDOW_MS,
  STUDENT_SUSPENSION_MS,
  canReport,
  cleanTags,
  decideStudentSanction,
  ratingAfterCase,
  validateRating,
} from "@/server/now/after-call-rules";
import { decideAccess } from "@/server/now/now-access";

const now = new Date("2026-10-17T14:00:00Z");

test("ratings: 1-5 stars, known tags once, tip within the cap", () => {
  assert.deepEqual(validateRating({ stars: 5, tags: ["friendly"], comment: null, tipCoins: 10 }, 50), []);
  assert.equal(validateRating({ stars: 0, tags: [], comment: null, tipCoins: 0 }, 50).length, 1);
  assert.equal(validateRating({ stars: 6, tags: [], comment: null, tipCoins: 0 }, 50).length, 1);
  assert.match(validateRating({ stars: 4, tags: ["great"], comment: null, tipCoins: 0 }, 50)[0], /Unknown tags/);
  assert.match(validateRating({ stars: 4, tags: ["friendly", "friendly"], comment: null, tipCoins: 0 }, 50)[0], /repeat/);
  assert.match(validateRating({ stars: 4, tags: [], comment: null, tipCoins: 51 }, 50)[0], /at most 50/);
  assert.match(validateRating({ stars: 4, tags: [], comment: null, tipCoins: 1.5 }, 50)[0], /whole number/);
  assert.match(validateRating({ stars: 4, tags: [], comment: "x".repeat(501), tipCoins: 0 }, 50)[0], /too long/);
  assert.deepEqual(cleanTags(["friendly", "nope", "friendly"]), ["friendly"]);
});

test("a live call can always be reported; an ended one for 7 days", () => {
  assert.equal(canReport(null, now), true);
  assert.equal(canReport(new Date(now.getTime() - REPORT_WINDOW_MS), now), true);
  assert.equal(canReport(new Date(now.getTime() - REPORT_WINDOW_MS - 1), now), false);
});

test("student strikes: severe → until review; two upheld → 30 days; guardian told", () => {
  assert.deepEqual(decideStudentSanction([{ reason: "wrong_content", at: now }], now), { kind: "none" });
  const second = decideStudentSanction(
    [
      { reason: "other", at: now },
      { reason: "contact_sharing", at: now },
    ],
    now,
  );
  assert.equal(second.kind, "suspend");
  if (second.kind === "suspend") {
    assert.equal(second.until?.getTime(), now.getTime() + STUDENT_SUSPENSION_MS);
    assert.equal(second.notifyGuardian, true);
  }
  for (const reason of ["abuse", "child_safety"] as const) {
    const severe = decideStudentSanction([{ reason, at: now }], now);
    assert.equal(severe.kind, "suspend");
    if (severe.kind === "suspend") assert.equal(severe.until, null, "until a founder reviews");
  }
});

test("a held rating counts again only if the case is dismissed", () => {
  assert.deepEqual(ratingAfterCase("dismissed"), { counted: true, held: false });
  assert.deepEqual(ratingAfterCase("upheld"), { counted: false, held: false });
});

test("a suspended student cannot ask for live help", () => {
  const base = { enabled: true, inCohort: true, isMinor: false, hasStudentConsent: false };
  assert.deepEqual(decideAccess({ ...base, suspended: true }), { canRequest: false, blockedReason: "suspended" });
  assert.deepEqual(decideAccess(base), { canRequest: true, blockedReason: null });
});

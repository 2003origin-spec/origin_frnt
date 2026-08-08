/**
 * The CBT participation-quota model.
 *
 * The invariants that make the cap trustworthy: a teacher with no cap is never
 * enforced against (the grandfather rule), a lobby seat reserves capacity so a
 * room full of students cannot blow past the cap when the test starts, an
 * exactly-full cap is spent rather than "one more allowed", and every seat that
 * has been consumed stays consumed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CBT_MAX_PARTICIPATION_QUOTA,
  CBT_MAX_PERIOD_DAYS,
  CBT_QUOTA_WARN_FRACTION,
  CbtQuotaError,
  addMonthsClamped,
  alreadyNotifiedThisPeriod,
  canAdmitParticipant,
  computeQuotaPeriod,
  deriveQuotaState,
  deriveQuotaStatus,
  describeResetPolicy,
  effectiveRoomCapacity,
  joinBlockMessage,
  joinBlockReason,
  normalizeQuotaInput,
  normalizeRequestedAdditional,
  normalizeResetPolicy,
  proposedGrantTotal,
  quotaBlockedMessage,
} from "@/lib/cbt/quota-model";

const iso = (s: string) => new Date(s);

// ── Grandfathering: a null quota is never enforced ──────────────────────────

test("a teacher with no cap is unlimited no matter how much they have used", () => {
  const state = deriveQuotaState({ quota: null, used: 9_999, held: 500 });
  assert.equal(state.status, "unlimited");
  assert.equal(state.blocked, false);
  assert.equal(state.nearLimit, false);
  assert.equal(state.remaining, null);
  assert.equal(state.usedFraction, null);
  assert.equal(canAdmitParticipant({ quota: null, used: 9_999, held: 500 }), true);
  assert.equal(joinBlockReason({ quota: null, used: 9_999, held: 500 }), null);
});

// ── Status derivation ───────────────────────────────────────────────────────

test("status walks granted -> no_seats -> exhausted as usage and holds grow", () => {
  assert.equal(deriveQuotaStatus({ quota: 10, used: 0, held: 0 }), "granted");
  assert.equal(deriveQuotaStatus({ quota: 10, used: 4, held: 5 }), "granted");
  // used + held reaches the cap: nobody NEW can join, but the 6 waiting may sit.
  assert.equal(deriveQuotaStatus({ quota: 10, used: 4, held: 6 }), "no_seats");
  assert.equal(deriveQuotaStatus({ quota: 10, used: 9, held: 1 }), "no_seats");
  assert.equal(deriveQuotaStatus({ quota: 10, used: 10, held: 0 }), "exhausted");
});

test("an exactly-full cap is spent, not one-more-allowed", () => {
  const state = deriveQuotaState({ quota: 100, used: 100, held: 0 });
  assert.equal(state.status, "exhausted");
  assert.equal(state.blocked, true);
  assert.equal(state.remaining, 0);
  assert.equal(canAdmitParticipant({ quota: 100, used: 100, held: 0 }), false);
  assert.equal(canAdmitParticipant({ quota: 100, used: 99, held: 0 }), true);
});

test("exhausted wins over no_seats when usage alone has spent the cap", () => {
  // An admin lowering the quota below current usage can produce used > quota
  // while students are still holding seats. The teacher is exhausted, and the
  // reported remaining never goes negative.
  const state = deriveQuotaState({ quota: 10, used: 25, held: 3 });
  assert.equal(state.status, "exhausted");
  assert.equal(state.remaining, 0);
  assert.equal(joinBlockReason({ quota: 10, used: 25, held: 3 }), "exhausted");
});

test("blocked and no_seats produce different student-facing copy", () => {
  assert.match(joinBlockMessage("exhausted"), /not accepting participants/i);
  assert.match(joinBlockMessage("no_seats"), /full/i);
  assert.notEqual(joinBlockMessage("exhausted"), joinBlockMessage("no_seats"));
});

test("the teacher-facing blocked message names the cap when there is one", () => {
  assert.match(quotaBlockedMessage(250), /250/);
  assert.match(quotaBlockedMessage(null), /limit is full/i);
});

// ── Derived numbers ─────────────────────────────────────────────────────────

test("remaining subtracts BOTH consumed and reserved seats, and never goes negative", () => {
  assert.equal(deriveQuotaState({ quota: 100, used: 60, held: 15 }).remaining, 25);
  assert.equal(deriveQuotaState({ quota: 100, used: 95, held: 20 }).remaining, 0);
  assert.equal(deriveQuotaState({ quota: 100, used: 120, held: 0 }).remaining, 0);
});

test("usedFraction is clamped to 1 and drives the 80% warning line", () => {
  assert.equal(deriveQuotaState({ quota: 100, used: 40, held: 0 }).nearLimit, false);
  assert.equal(deriveQuotaState({ quota: 100, used: 79, held: 0 }).nearLimit, false);
  assert.equal(
    deriveQuotaState({ quota: 100, used: Math.ceil(100 * CBT_QUOTA_WARN_FRACTION), held: 0 }).nearLimit,
    true,
  );
  assert.equal(deriveQuotaState({ quota: 100, used: 300, held: 0 }).usedFraction, 1);
});

test("negative or fractional counts are normalised before they are shown", () => {
  const state = deriveQuotaState({ quota: 10, used: -5, held: 2.9 });
  assert.equal(state.used, 0);
  assert.equal(state.held, 2);
  assert.equal(state.remaining, 8);
});

test("effectiveRoomCapacity takes the stricter of room capacity and quota", () => {
  assert.equal(effectiveRoomCapacity(200, null), 200); // unlimited teacher
  assert.equal(effectiveRoomCapacity(200, 30), 30); // quota is the ceiling
  assert.equal(effectiveRoomCapacity(20, 500), 20); // room is the ceiling
  assert.equal(effectiveRoomCapacity(200, 0), 0);
  assert.equal(effectiveRoomCapacity(200, -4), 0);
});

// ── Admin input normalisation ───────────────────────────────────────────────

test("an empty admin field means 'remove the cap', not 'zero'", () => {
  assert.equal(normalizeQuotaInput(""), null);
  assert.equal(normalizeQuotaInput(null), null);
  assert.equal(normalizeQuotaInput(undefined), null);
});

test("a quota is a positive whole number, floored, within the sanity bound", () => {
  assert.equal(normalizeQuotaInput(50), 50);
  assert.equal(normalizeQuotaInput("120"), 120);
  assert.equal(normalizeQuotaInput(" 75 "), 75);
  assert.equal(normalizeQuotaInput(12.9), 12);
  assert.equal(normalizeQuotaInput(CBT_MAX_PARTICIPATION_QUOTA), CBT_MAX_PARTICIPATION_QUOTA);

  // Zero is rejected on purpose: "blocked forever" is what disabling a teacher
  // is for, and null already means "no cap".
  assert.throws(() => normalizeQuotaInput(0), CbtQuotaError);
  assert.throws(() => normalizeQuotaInput(-10), CbtQuotaError);
  assert.throws(() => normalizeQuotaInput("abc"), CbtQuotaError);
  assert.throws(() => normalizeQuotaInput(Number.NaN), CbtQuotaError);
  assert.throws(() => normalizeQuotaInput(Number.POSITIVE_INFINITY), CbtQuotaError);
  assert.throws(() => normalizeQuotaInput(CBT_MAX_PARTICIPATION_QUOTA + 1), CbtQuotaError);
});

test("a rejected quota input carries a 400 and a machine-readable code", () => {
  try {
    normalizeQuotaInput(0);
    assert.fail("expected a CbtQuotaError");
  } catch (error) {
    assert.ok(error instanceof CbtQuotaError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "invalid_quota");
  }
});

test("a teacher's requested increment must be a positive whole number", () => {
  assert.equal(normalizeRequestedAdditional(200), 200);
  assert.equal(normalizeRequestedAdditional("200"), 200);
  assert.equal(normalizeRequestedAdditional(9.7), 9);
  assert.throws(() => normalizeRequestedAdditional(0), CbtQuotaError);
  assert.throws(() => normalizeRequestedAdditional(-1), CbtQuotaError);
  assert.throws(() => normalizeRequestedAdditional(""), CbtQuotaError);
  assert.throws(() => normalizeRequestedAdditional(undefined), CbtQuotaError);
  assert.throws(() => normalizeRequestedAdditional(CBT_MAX_PARTICIPATION_QUOTA + 1), CbtQuotaError);
});

test("the approve button proposes current cap + requested increment", () => {
  assert.equal(proposedGrantTotal(100, 200), 300);
  // A teacher with no cap who files a request gets the increment as their first cap.
  assert.equal(proposedGrantTotal(null, 200), 200);
  // Never proposes past the sanity bound.
  assert.equal(
    proposedGrantTotal(CBT_MAX_PARTICIPATION_QUOTA, 5_000),
    CBT_MAX_PARTICIPATION_QUOTA,
  );
});

// ── Renewal periods (the monthly auto-reset) ────────────────────────────────

test("no renewal policy means one lifetime window", () => {
  const period = computeQuotaPeriod({ mode: "none", periodDays: null, anchor: null }, iso("2026-08-08T00:00:00Z"));
  assert.equal(period.mode, "none");
  assert.equal(period.start, null, "a null start means the count query bounds nothing");
  assert.equal(period.end, null);
  assert.equal(period.daysUntilReset, null);
  assert.equal(period.index, null);
  assert.equal(describeResetPolicy(period), "does not renew");
});

test("a renewing mode with no anchor degrades to no window rather than throwing", () => {
  const period = computeQuotaPeriod({ mode: "monthly", periodDays: null, anchor: null });
  assert.equal(period.start, null);
  assert.equal(period.end, null);
});

test("monthly renewal lands on the anchor's day-of-month, every month", () => {
  const policy = { mode: "monthly" as const, periodDays: null, anchor: iso("2026-03-05T10:00:00Z") };

  // Inside the first cycle.
  let p = computeQuotaPeriod(policy, iso("2026-03-20T00:00:00Z"));
  assert.equal(p.index, 0);
  assert.equal(p.start, "2026-03-05T10:00:00.000Z");
  assert.equal(p.end, "2026-04-05T10:00:00.000Z");

  // One second before the boundary is still the first cycle.
  p = computeQuotaPeriod(policy, iso("2026-04-05T09:59:59Z"));
  assert.equal(p.index, 0);
  // The boundary instant itself starts the second cycle: the allowance resets.
  p = computeQuotaPeriod(policy, iso("2026-04-05T10:00:00Z"));
  assert.equal(p.index, 1);
  assert.equal(p.start, "2026-04-05T10:00:00.000Z");
  assert.equal(p.end, "2026-05-05T10:00:00.000Z");

  // Five months later, without anyone having "rolled" anything.
  p = computeQuotaPeriod(policy, iso("2026-08-08T00:00:00Z"));
  assert.equal(p.index, 5);
  assert.equal(p.start, "2026-08-05T10:00:00.000Z");
  assert.equal(p.end, "2026-09-05T10:00:00.000Z");
});

test("a month-end anchor clamps into February but never drifts earlier", () => {
  // The bug this guards: rolling forward from the PREVIOUS window would leave a
  // 31st-of-the-month subscription permanently stuck on the 28th.
  assert.equal(addMonthsClamped(iso("2026-01-31T00:00:00Z"), 1).toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(addMonthsClamped(iso("2026-01-31T00:00:00Z"), 2).toISOString(), "2026-03-31T00:00:00.000Z");
  // Leap year.
  assert.equal(addMonthsClamped(iso("2028-01-31T00:00:00Z"), 1).toISOString(), "2028-02-29T00:00:00.000Z");
  // Year rollover.
  assert.equal(addMonthsClamped(iso("2026-12-15T00:00:00Z"), 1).toISOString(), "2027-01-15T00:00:00.000Z");

  const policy = { mode: "monthly" as const, periodDays: null, anchor: iso("2026-01-31T00:00:00Z") };
  const feb = computeQuotaPeriod(policy, iso("2026-02-10T00:00:00Z"));
  assert.equal(feb.start, "2026-01-31T00:00:00.000Z");
  assert.equal(feb.end, "2026-02-28T00:00:00.000Z");
  const mar = computeQuotaPeriod(policy, iso("2026-03-05T00:00:00Z"));
  assert.equal(mar.start, "2026-02-28T00:00:00.000Z");
  assert.equal(mar.end, "2026-03-31T00:00:00.000Z", "back to the 31st, not stuck on the 28th");
});

test("N-day renewal steps in fixed windows from the anchor", () => {
  const policy = { mode: "days" as const, periodDays: 7, anchor: iso("2026-08-01T00:00:00Z") };
  let p = computeQuotaPeriod(policy, iso("2026-08-03T00:00:00Z"));
  assert.equal(p.index, 0);
  assert.equal(p.start, "2026-08-01T00:00:00.000Z");
  assert.equal(p.end, "2026-08-08T00:00:00.000Z");
  assert.equal(p.daysUntilReset, 5);

  p = computeQuotaPeriod(policy, iso("2026-08-08T00:00:00Z"));
  assert.equal(p.index, 1, "the boundary instant belongs to the NEXT window");
  assert.equal(p.start, "2026-08-08T00:00:00.000Z");

  p = computeQuotaPeriod(policy, iso("2026-09-30T12:00:00Z"));
  assert.equal(p.index, 8);
  assert.equal(describeResetPolicy(p), "renews every 7 days");
});

test("a `now` before the anchor stays in the first cycle (index 0)", () => {
  const monthly = computeQuotaPeriod(
    { mode: "monthly", periodDays: null, anchor: iso("2026-08-20T00:00:00Z") },
    iso("2026-08-01T00:00:00Z"),
  );
  assert.equal(monthly.index, 0);
  assert.equal(monthly.start, "2026-08-20T00:00:00.000Z");

  const days = computeQuotaPeriod(
    { mode: "days", periodDays: 30, anchor: iso("2026-08-20T00:00:00Z") },
    iso("2026-08-01T00:00:00Z"),
  );
  assert.equal(days.index, 0);
});

test("daysUntilReset is a whole-day countdown that bottoms out at 0", () => {
  const policy = { mode: "monthly" as const, periodDays: null, anchor: iso("2026-08-01T00:00:00Z") };
  assert.equal(computeQuotaPeriod(policy, iso("2026-08-31T12:00:00Z")).daysUntilReset, 1);
  assert.equal(computeQuotaPeriod(policy, iso("2026-08-31T23:59:59Z")).daysUntilReset, 1);
  // Exactly at the boundary we are already in the next window, a full month out.
  assert.ok((computeQuotaPeriod(policy, iso("2026-09-01T00:00:00Z")).daysUntilReset ?? 0) >= 29);
});

test("the blocked message tells a subscriber when their allowance comes back", () => {
  const period = computeQuotaPeriod(
    { mode: "monthly", periodDays: null, anchor: iso("2026-08-01T00:00:00Z") },
    iso("2026-08-30T00:00:00Z"),
  );
  const msg = quotaBlockedMessage(100, period);
  assert.match(msg, /renews in 2 days/);
  // A lifetime cap has no renewal to promise.
  assert.doesNotMatch(quotaBlockedMessage(100), /renews/);
});

test("the exhaustion notification re-arms on renewal", () => {
  const policy = { mode: "monthly" as const, periodDays: null, anchor: iso("2026-08-01T00:00:00Z") };
  const august = computeQuotaPeriod(policy, iso("2026-08-15T00:00:00Z"));
  const september = computeQuotaPeriod(policy, iso("2026-09-15T00:00:00Z"));

  // Told during August: don't tell them twice in August…
  assert.equal(alreadyNotifiedThisPeriod("2026-08-10T00:00:00Z", august), true);
  // …but September is a new cycle, so a fresh exhaustion is announced again.
  assert.equal(alreadyNotifiedThisPeriod("2026-08-10T00:00:00Z", september), false);
  assert.equal(alreadyNotifiedThisPeriod(null, august), false);
  assert.equal(alreadyNotifiedThisPeriod("not-a-date", august), false);

  // A lifetime cap notifies exactly once, ever.
  const lifetime = computeQuotaPeriod({ mode: "none", periodDays: null, anchor: null });
  assert.equal(alreadyNotifiedThisPeriod("2020-01-01T00:00:00Z", lifetime), true);
});

test("deriveQuotaState carries the period through to the client", () => {
  const period = computeQuotaPeriod(
    { mode: "monthly", periodDays: null, anchor: iso("2026-08-01T00:00:00Z") },
    iso("2026-08-10T00:00:00Z"),
  );
  const state = deriveQuotaState({ quota: 100, used: 100, held: 0 }, period);
  assert.equal(state.blocked, true);
  assert.equal(state.period.mode, "monthly");
  assert.equal(state.period.end, "2026-09-01T00:00:00.000Z");
  // Default (no period argument) behaves like a lifetime cap.
  assert.equal(deriveQuotaState({ quota: 100, used: 1, held: 0 }).period.mode, "none");
});

// ── Reset-policy input validation ───────────────────────────────────────────

test("mode 'none' discards any period fields it was sent", () => {
  const policy = normalizeResetPolicy({ mode: "none", periodDays: 30, anchor: "2026-01-01" });
  assert.deepEqual(policy, { mode: "none", periodDays: null, anchor: null });
  // Absent / blank mode is treated as 'none'.
  assert.equal(normalizeResetPolicy({}).mode, "none");
  assert.equal(normalizeResetPolicy({ mode: "" }).mode, "none");
});

test("monthly defaults its anchor to now when no date is given", () => {
  const now = iso("2026-08-08T09:30:00Z");
  const policy = normalizeResetPolicy({ mode: "monthly" }, now);
  assert.equal(policy.mode, "monthly");
  assert.equal(policy.anchor?.toISOString(), now.toISOString());
  assert.equal(policy.periodDays, null);
});

test("a future anchor is rejected — it would leave a window of uncharged tests", () => {
  const now = iso("2026-08-08T00:00:00Z");
  assert.throws(() => normalizeResetPolicy({ mode: "monthly", anchor: "2026-09-01" }, now), CbtQuotaError);
  // A past date is exactly the "subscription started on…" case, and is fine.
  assert.equal(
    normalizeResetPolicy({ mode: "monthly", anchor: "2026-03-05" }, now).anchor?.toISOString(),
    "2026-03-05T00:00:00.000Z",
  );
  // Today in a timezone ahead of UTC must not be read as "the future".
  assert.ok(normalizeResetPolicy({ mode: "monthly", anchor: "2026-08-08T18:30:00Z" }, now).anchor);
  assert.throws(() => normalizeResetPolicy({ mode: "monthly", anchor: "nonsense" }, now), CbtQuotaError);
});

test("mode 'days' requires a positive length inside the bound", () => {
  const now = iso("2026-08-08T00:00:00Z");
  assert.equal(normalizeResetPolicy({ mode: "days", periodDays: 90 }, now).periodDays, 90);
  assert.equal(normalizeResetPolicy({ mode: "days", periodDays: "45" }, now).periodDays, 45);
  assert.throws(() => normalizeResetPolicy({ mode: "days" }, now), CbtQuotaError);
  assert.throws(() => normalizeResetPolicy({ mode: "days", periodDays: 0 }, now), CbtQuotaError);
  assert.throws(() => normalizeResetPolicy({ mode: "days", periodDays: -7 }, now), CbtQuotaError);
  assert.throws(
    () => normalizeResetPolicy({ mode: "days", periodDays: CBT_MAX_PERIOD_DAYS + 1 }, now),
    CbtQuotaError,
  );
});

test("an unknown renewal mode is rejected", () => {
  assert.throws(() => normalizeResetPolicy({ mode: "weekly" }), CbtQuotaError);
  try {
    normalizeResetPolicy({ mode: "weekly" });
  } catch (error) {
    assert.ok(error instanceof CbtQuotaError);
    assert.equal(error.status, 400);
    assert.equal(error.code, "invalid_reset_mode");
  }
});

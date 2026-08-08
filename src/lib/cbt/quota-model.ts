/**
 * Pure model for the CBT participation quota. No I/O — every rule that decides
 * whether a teacher may open a room, reveal a code, or admit one more student
 * lives here so it can be unit-tested exhaustively.
 *
 * Vocabulary (see V1/CBT_PARTICIPATION_QUOTA_PLAN.md §3.4):
 *   quota  — the admin's cap. `null` means UNLIMITED (the grandfather rule).
 *   used   — participations already consumed. PERMANENT: one per participant who
 *            started a test, and deleting the room does not give it back.
 *   held   — students sitting in the teacher's still-open rooms who have not
 *            started yet. A transient RESERVATION, never billed: it is what
 *            stops 60 lobby students from blowing past a cap of 5 the instant
 *            the teacher presses Start.
 */

export type CbtQuotaStatus =
  /** No cap set — enforcement never runs. */
  | "unlimited"
  /** Under the cap with at least one free seat. */
  | "granted"
  /** Cap not yet consumed, but every remaining seat is reserved by a lobby. */
  | "no_seats"
  /** Cap fully consumed. Rooms, codes and joins are blocked. */
  | "exhausted";

export type CbtQuotaCounts = {
  quota: number | null;
  used: number;
  held: number;
};

export type CbtQuotaState = CbtQuotaCounts & {
  status: CbtQuotaStatus;
  /** Seats a NEW student could still take. `null` when unlimited. */
  remaining: number | null;
  /** used / quota as 0..1. `null` when unlimited. */
  usedFraction: number | null;
  /** True once the cap is consumed — this is what blocks the link and the code. */
  blocked: boolean;
  /** True once usage is at or past the warning line (80%). */
  nearLimit: boolean;
  /** The renewal policy + the window `used` is counted over. */
  period: CbtQuotaPeriodState;
};

// ── Renewal periods (subscription billing cycles) ───────────────────────────

/**
 * How a teacher's allowance renews.
 *   none    — a lifetime cap. `used` is everything they have ever consumed.
 *   monthly — renews on the anchor's day-of-month, every calendar month.
 *   days    — renews every N days from the anchor (e.g. 7, 90, 365).
 */
export type CbtQuotaResetMode = "none" | "monthly" | "days";

export type CbtQuotaResetPolicy = {
  mode: CbtQuotaResetMode;
  /** Cycle length for mode `days`. Ignored otherwise. */
  periodDays: number | null;
  /**
   * The immutable cycle anchor — the subscription start date an admin picked.
   * Every window is computed FROM this, never from the previous window, so a
   * cycle anchored on the 31st keeps landing on the 31st instead of drifting
   * earlier through the short months.
   */
  anchor: Date | null;
};

export type CbtQuotaPeriodState = {
  mode: CbtQuotaResetMode;
  periodDays: number | null;
  /** ISO anchor, or null when the cap is a lifetime one. */
  anchor: string | null;
  /** Start of the window `used` counts over. Null = count everything, forever. */
  start: string | null;
  /** When the allowance next resets to 0. Null when it never does. */
  end: string | null;
  /** Whole days until the reset (0 = today). Null when it never resets. */
  daysUntilReset: number | null;
  /** 0 for the first cycle, 1 for the second, … Null when there is no cycle. */
  index: number | null;
};

export const CBT_MAX_PERIOD_DAYS = 3_650;

/** Days in `month` (0-11) of `year`, honouring leap years. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * `anchor` shifted forward by `months`, keeping its day-of-month and clamping to
 * the last day of a shorter target month (31 Jan + 1 month → 28/29 Feb).
 */
export function addMonthsClamped(anchor: Date, months: number): Date {
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), daysInMonth(targetYear, targetMonth));
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
      anchor.getUTCMilliseconds(),
    ),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The renewal window containing `now`.
 *
 * Deliberately DERIVED rather than stored: there is no "reset job" that could
 * fail, no stored window that could drift, and no race between two requests
 * both trying to roll a teacher forward. A teacher who was idle for eight months
 * lands in the correct current cycle on their next request, with usage from the
 * older cycles still on the ledger for audit but outside the counting window.
 *
 * `now` before the anchor keeps the FIRST window (index 0), so an allowance an
 * admin dates from today is immediately usable.
 */
export function computeQuotaPeriod(policy: CbtQuotaResetPolicy, now: Date = new Date()): CbtQuotaPeriodState {
  const base: CbtQuotaPeriodState = {
    mode: policy.mode,
    periodDays: policy.periodDays,
    anchor: policy.anchor ? policy.anchor.toISOString() : null,
    start: null,
    end: null,
    daysUntilReset: null,
    index: null,
  };
  if (policy.mode === "none" || !policy.anchor) return { ...base, mode: policy.mode };

  const anchor = policy.anchor;
  let index = 0;
  let start: Date;
  let end: Date;

  if (policy.mode === "monthly") {
    index =
      (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
    // The month arithmetic above ignores day-of-month, so step back when the
    // computed cycle has not actually begun yet.
    if (index > 0 && addMonthsClamped(anchor, index).getTime() > now.getTime()) index -= 1;
    if (index < 0) index = 0;
    start = addMonthsClamped(anchor, index);
    end = addMonthsClamped(anchor, index + 1);
  } else {
    const lengthDays = Math.max(1, Math.floor(policy.periodDays ?? 30));
    const lengthMs = lengthDays * DAY_MS;
    const elapsed = now.getTime() - anchor.getTime();
    index = elapsed <= 0 ? 0 : Math.floor(elapsed / lengthMs);
    start = new Date(anchor.getTime() + index * lengthMs);
    end = new Date(start.getTime() + lengthMs);
  }

  return {
    ...base,
    start: start.toISOString(),
    end: end.toISOString(),
    daysUntilReset: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)),
    index,
  };
}

/** Has this teacher already been told they are full *in the current cycle*? */
export function alreadyNotifiedThisPeriod(
  notifiedAt: Date | string | null,
  period: CbtQuotaPeriodState,
): boolean {
  if (!notifiedAt) return false;
  const at = notifiedAt instanceof Date ? notifiedAt : new Date(notifiedAt);
  if (Number.isNaN(at.getTime())) return false;
  // A lifetime cap has no window: one notification is the whole story.
  if (!period.start) return true;
  return at.getTime() >= new Date(period.start).getTime();
}

/** The share of quota at which the teacher gets a heads-up in the navbar. */
export const CBT_QUOTA_WARN_FRACTION = 0.8;

/** Sanity bound on a single admin grant / teacher request. */
export const CBT_MAX_PARTICIPATION_QUOTA = 1_000_000;

export function deriveQuotaStatus(counts: CbtQuotaCounts): CbtQuotaStatus {
  const { quota, used, held } = counts;
  if (quota === null) return "unlimited";
  // `>=` matches the shipped code-access precedent (`connected >= quota`): a
  // quota of 100 with 100 used is spent, not "one more allowed".
  if (used >= quota) return "exhausted";
  if (used + held >= quota) return "no_seats";
  return "granted";
}

const NO_PERIOD: CbtQuotaPeriodState = {
  mode: "none",
  periodDays: null,
  anchor: null,
  start: null,
  end: null,
  daysUntilReset: null,
  index: null,
};

export function deriveQuotaState(
  counts: CbtQuotaCounts,
  period: CbtQuotaPeriodState = NO_PERIOD,
): CbtQuotaState {
  const quota = counts.quota;
  const used = Math.max(0, Math.floor(counts.used));
  const held = Math.max(0, Math.floor(counts.held));
  const status = deriveQuotaStatus({ quota, used, held });
  return {
    quota,
    used,
    held,
    status,
    remaining: quota === null ? null : Math.max(0, quota - used - held),
    usedFraction: quota === null || quota <= 0 ? null : Math.min(1, used / quota),
    blocked: status === "exhausted",
    nearLimit: quota !== null && quota > 0 && used / quota >= CBT_QUOTA_WARN_FRACTION,
    period,
  };
}

/** True when one more student may take a seat right now. */
export function canAdmitParticipant(counts: CbtQuotaCounts): boolean {
  const status = deriveQuotaStatus(counts);
  return status === "unlimited" || status === "granted";
}

/**
 * Room capacity a teacher can actually fill: the smaller of the room's own
 * capacity and the seats their quota still leaves. Used for the create-dialog
 * hint; the authoritative check is the transactional one at join time.
 */
export function effectiveRoomCapacity(roomCapacity: number, remaining: number | null): number {
  if (remaining === null) return roomCapacity;
  return Math.max(0, Math.min(roomCapacity, remaining));
}

export type CbtQuotaBlockReason = "exhausted" | "no_seats";

/**
 * Why a join must be refused, or `null` when it may proceed. Kept separate from
 * `canAdmitParticipant` because the two cases need different student-facing
 * copy: one is the institute's problem, the other resolves itself.
 */
export function joinBlockReason(counts: CbtQuotaCounts): CbtQuotaBlockReason | null {
  const status = deriveQuotaStatus(counts);
  if (status === "exhausted") return "exhausted";
  if (status === "no_seats") return "no_seats";
  return null;
}

/** Student-facing copy for a refused join. Deliberately blame-free. */
export function joinBlockMessage(reason: CbtQuotaBlockReason): string {
  return reason === "exhausted"
    ? "This room is not accepting participants. Please contact your institute."
    : "This room is full. Please contact your teacher.";
}

/** Teacher-facing copy for a blocked room / code / link. */
export function quotaBlockedMessage(quota: number | null, period?: CbtQuotaPeriodState): string {
  const head =
    quota === null
      ? "Your participation limit is full."
      : `Your participation limit of ${quota.toLocaleString("en-IN")} is full.`;
  // A renewing allowance is a wait, not a dead end — say when it comes back.
  if (period?.end) {
    const days = period.daysUntilReset ?? 0;
    const when = days === 0 ? "later today" : days === 1 ? "tomorrow" : `in ${days} days`;
    return `${head} It renews ${when}, or request more to continue now.`;
  }
  return `${head} Request more to open new rooms.`;
}

/** Human label for a renewal policy, used in both admin and teacher copy. */
export function describeResetPolicy(period: CbtQuotaPeriodState): string {
  if (period.mode === "monthly") return "renews monthly";
  if (period.mode === "days") return `renews every ${(period.periodDays ?? 30).toLocaleString("en-IN")} days`;
  return "does not renew";
}

export class CbtQuotaError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "quota_blocked") {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "CbtQuotaError";
  }
}

/**
 * Validates an admin-entered quota. Returns a positive integer, or `null` when
 * the input means "clear the cap" (empty string / null / undefined).
 */
export function normalizeQuotaInput(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n)) {
    throw new CbtQuotaError(400, "Enter a whole number of participations.", "invalid_quota");
  }
  const quota = Math.floor(n);
  if (quota <= 0) {
    throw new CbtQuotaError(
      400,
      "A quota must be at least 1. To remove the cap, clear the field instead.",
      "invalid_quota",
    );
  }
  if (quota > CBT_MAX_PARTICIPATION_QUOTA) {
    throw new CbtQuotaError(
      400,
      `That's above the maximum of ${CBT_MAX_PARTICIPATION_QUOTA.toLocaleString("en-IN")}.`,
      "invalid_quota",
    );
  }
  return quota;
}

/** Validates the extra participations a teacher is asking for. */
export function normalizeRequestedAdditional(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
  const count = Math.floor(n);
  if (!Number.isFinite(count) || count <= 0) {
    throw new CbtQuotaError(400, "Enter how many more participations you need.", "invalid_request");
  }
  if (count > CBT_MAX_PARTICIPATION_QUOTA) {
    throw new CbtQuotaError(
      400,
      `That's above the maximum of ${CBT_MAX_PARTICIPATION_QUOTA.toLocaleString("en-IN")}.`,
      "invalid_request",
    );
  }
  return count;
}

/**
 * The new total an admin gets pre-filled when approving a request: whatever the
 * teacher currently has plus what they asked for. A teacher on the unlimited
 * plan who somehow files a request is proposed their request as the first cap.
 */
export function proposedGrantTotal(currentQuota: number | null, requestedAdditional: number): number {
  return Math.min(CBT_MAX_PARTICIPATION_QUOTA, (currentQuota ?? 0) + requestedAdditional);
}

// ── Reset-policy input validation ───────────────────────────────────────────

export type CbtQuotaResetInput = {
  mode?: unknown;
  periodDays?: unknown;
  /** ISO date (or datetime) the admin picked as the cycle start. */
  anchor?: unknown;
};

/**
 * Validates the admin's renewal settings into a storable policy.
 *
 * The anchor must not be in the future: `used` counts from the window start, so
 * a future-dated cycle would leave a gap in which tests run uncharged. Dating a
 * cycle from today or from the real subscription start date both work.
 */
export function normalizeResetPolicy(
  input: CbtQuotaResetInput,
  now: Date = new Date(),
): CbtQuotaResetPolicy {
  const rawMode = input.mode === undefined || input.mode === null || input.mode === "" ? "none" : String(input.mode);
  if (rawMode !== "none" && rawMode !== "monthly" && rawMode !== "days") {
    throw new CbtQuotaError(400, "Choose a renewal of none, monthly, or a number of days.", "invalid_reset_mode");
  }
  if (rawMode === "none") return { mode: "none", periodDays: null, anchor: null };

  let periodDays: number | null = null;
  if (rawMode === "days") {
    const n = typeof input.periodDays === "number" ? input.periodDays : Number(String(input.periodDays ?? "").trim());
    periodDays = Math.floor(n);
    if (!Number.isFinite(periodDays) || periodDays <= 0) {
      throw new CbtQuotaError(400, "Enter how many days each cycle lasts.", "invalid_period_days");
    }
    if (periodDays > CBT_MAX_PERIOD_DAYS) {
      throw new CbtQuotaError(
        400,
        `A cycle can be at most ${CBT_MAX_PERIOD_DAYS.toLocaleString("en-IN")} days.`,
        "invalid_period_days",
      );
    }
  }

  // Default the anchor to now, so "monthly" with no date just starts today.
  const rawAnchor = input.anchor;
  let anchor: Date;
  if (rawAnchor === undefined || rawAnchor === null || rawAnchor === "") {
    anchor = now;
  } else {
    anchor = rawAnchor instanceof Date ? rawAnchor : new Date(String(rawAnchor));
    if (Number.isNaN(anchor.getTime())) {
      throw new CbtQuotaError(400, "Enter a valid renewal start date.", "invalid_anchor");
    }
  }
  // Tolerate a day of clock skew / a date-only input for "today" in any timezone.
  if (anchor.getTime() - now.getTime() > DAY_MS) {
    throw new CbtQuotaError(
      400,
      "The renewal start date can't be in the future — pick today or the date the subscription began.",
      "invalid_anchor",
    );
  }

  return { mode: rawMode, periodDays, anchor };
}

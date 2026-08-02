/**
 * Why a CBT attempt ended — pure logic shared by the attempt service, the Excel
 * export and the unit tests.
 *
 * The important invariant: **"absent" means the student never entered the
 * paper.** Before this module existed, anyone whose browser died mid-test was
 * left with `finished_at IS NULL` forever and the export reported them as
 * absent with a blank score, throwing away answers the server was already
 * holding. Now a participant who entered the test (or has a draft) is always
 * graded from that draft when the duration expires, and the reason records
 * whether they were at the keyboard at the time.
 */

export const CBT_FINALIZE_REASONS = [
  "manual",
  "timer",
  "malpractice",
  "expired_offline",
  "room_closed",
  "forced_by_teacher",
  "absent",
] as const;

export type CbtFinalizeReason = (typeof CBT_FINALIZE_REASONS)[number];

/** Presence window shared with the rooms service: no heartbeat for 45s = offline. */
export const CBT_PRESENCE_WINDOW_MS = 45_000;

export function isCbtFinalizeReason(value: unknown): value is CbtFinalizeReason {
  return typeof value === "string" && (CBT_FINALIZE_REASONS as readonly string[]).includes(value);
}

export type FinalizeReasonInput = {
  /** When the participant first opened the paper (null = lobby only). */
  enteredTestAt: string | Date | null;
  /** Last heartbeat / autosave. */
  lastSeenAt: string | Date | null;
  /** Whether the server holds a draft row with at least one answer. */
  hasDraft: boolean;
  /** Evaluation instant (ms). */
  now: number;
  presenceWindowMs?: number;
};

function toMs(value: string | Date | null): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Reason for a deadline-driven finalization (the sweep / lazy finalize).
 *
 *  • never entered AND no draft            → `absent`  (a true no-show; stays
 *                                             unscored so the teacher can tell
 *                                             them apart from a zero)
 *  • last seen longer ago than the presence
 *    window                                → `expired_offline`  ("got offline
 *                                             during the test and never came
 *                                             back" — graded from the draft)
 *  • otherwise                             → `timer`   (present at the deadline;
 *                                             the client auto-submit simply
 *                                             didn't land first)
 */
export function deriveFinalizeReason(input: FinalizeReasonInput): CbtFinalizeReason {
  const entered = toMs(input.enteredTestAt) !== null;
  if (!entered && !input.hasDraft) return "absent";

  const window = input.presenceWindowMs ?? CBT_PRESENCE_WINDOW_MS;
  const lastSeen = toMs(input.lastSeenAt);
  if (lastSeen === null || input.now - lastSeen > window) return "expired_offline";
  return "timer";
}

/** An `absent` participant is recorded as finished but deliberately not graded. */
export function isGradedReason(reason: CbtFinalizeReason): boolean {
  return reason !== "absent";
}

/**
 * Short status word for the export's Status column.
 *
 * `reason` is NULL for rows finished before the 20260802 deploy and for the
 * window in which the online backfill is still catching up, so both label
 * helpers fall back to the legacy `auto_submitted` boolean — an export taken
 * mid-backfill reads exactly as it did before.
 */
export function finalizeStatusLabel(
  reason: CbtFinalizeReason | null,
  finishedAt: unknown,
  legacyAutoSubmitted = false,
): string {
  if (!finishedAt) return "in progress";
  if (reason === null || reason === undefined) return legacyAutoSubmitted ? "auto-submitted" : "submitted";
  switch (reason) {
    case "manual":
      return "submitted";
    case "absent":
      return "absent";
    case "malpractice":
      return "terminated";
    default:
      return "auto-submitted";
  }
}

/** Human remark for the export's Remark column. */
export function finalizeRemark(
  reason: CbtFinalizeReason | null,
  finishedAt: unknown,
  legacyAutoSubmitted = false,
): string {
  if (!finishedAt) return "Test still in progress at export time";
  if (reason === null || reason === undefined) {
    return legacyAutoSubmitted ? "Auto-submitted when the time ended" : "";
  }
  switch (reason) {
    case "expired_offline":
      return "Got offline during the test and never came back";
    case "timer":
      return "Auto-submitted when the time ended";
    case "malpractice":
      return "Auto-submitted after 3 integrity violations";
    case "room_closed":
      return "Room was closed by the teacher before submission";
    case "forced_by_teacher":
      return "Finalized by the teacher";
    case "absent":
      return "Never entered the test";
    default:
      return "";
  }
}

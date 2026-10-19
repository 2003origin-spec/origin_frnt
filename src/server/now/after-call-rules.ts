/**
 * Pure rules for what happens after an Origin NOW call (plan doc, "Ratings,
 * outcome, reports and strikes" and "Targeted practice"; build step 7).
 */

import { FEEDBACK_TAGS, type FeedbackTag } from "./types";

export const REPORT_REASONS = ["child_safety", "abuse", "contact_sharing", "wrong_content", "no_show", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** A session can be reported for this long after it ends (the room, the rating screen, history). */
export const REPORT_WINDOW_MS = 7 * 24 * 60 * 60_000;

/** Student sanctions (plan doc): two upheld reports → 30 days; one upheld abuse → until a founder reviews. */
export const STUDENT_SUSPENSION_MS = 30 * 24 * 60 * 60_000;
const SEVERE_REASONS: ReadonlySet<ReportReason> = new Set(["abuse", "child_safety"]);

export const PRACTICE_QUESTION_COUNT = 3;

export function isReportReason(value: unknown): value is ReportReason {
  return typeof value === "string" && (REPORT_REASONS as readonly string[]).includes(value);
}

export type RatingInput = { stars: number; tags: readonly string[]; comment: string | null; tipCoins: number };

export function validateRating(input: RatingInput, tipCap: number): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) errors.push("Stars must be 1 to 5.");
  const unknown = input.tags.filter((t) => !(FEEDBACK_TAGS as readonly string[]).includes(t));
  if (unknown.length) errors.push(`Unknown tags: ${unknown.join(", ")}.`);
  if (new Set(input.tags).size !== input.tags.length) errors.push("Tags must not repeat.");
  if ((input.comment ?? "").length > 500) errors.push("Comment is too long (500 characters at most).");
  if (!Number.isInteger(input.tipCoins) || input.tipCoins < 0) errors.push("Tip must be a whole number of coins.");
  else if (input.tipCoins > tipCap) errors.push(`Tip can be at most ${tipCap} coins.`);
  return errors;
}

export function cleanTags(tags: readonly string[]): FeedbackTag[] {
  return [...new Set(tags)].filter((t): t is FeedbackTag => (FEEDBACK_TAGS as readonly string[]).includes(t));
}

export function canReport(endedAt: Date | null, now: Date): boolean {
  // A live call can always be reported; an ended one within the window.
  return endedAt === null || now.getTime() - endedAt.getTime() <= REPORT_WINDOW_MS;
}

export type StudentSanction =
  | { kind: "none" }
  | { kind: "suspend"; until: Date | null; notifyGuardian: boolean; reason: string };

/**
 * Called when a report against a STUDENT is upheld. `upheld` includes the one
 * just upheld. Severe reasons suspend until a founder reviews; otherwise the
 * second upheld report suspends for 30 days. The guardian is told either way.
 */
export function decideStudentSanction(
  upheld: readonly { reason: ReportReason; at: Date }[],
  now: Date,
): StudentSanction {
  const latest = upheld[upheld.length - 1];
  if (latest && SEVERE_REASONS.has(latest.reason)) {
    return { kind: "suspend", until: null, notifyGuardian: true, reason: `Upheld ${latest.reason.replace("_", " ")} report` };
  }
  if (upheld.length >= 2) {
    return {
      kind: "suspend",
      until: new Date(now.getTime() + STUDENT_SUSPENSION_MS),
      notifyGuardian: true,
      reason: `${upheld.length} upheld reports`,
    };
  }
  return { kind: "none" };
}

/**
 * What happens to the rating the REPORTED side gave on that session once the
 * case closes: dismissed → it counts again; upheld → it never counts.
 */
export function ratingAfterCase(outcome: "upheld" | "dismissed"): { counted: boolean; held: false } {
  return { counted: outcome === "dismissed", held: false };
}

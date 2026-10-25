/**
 * Group sessions (decision B95) — pure rules. A verified solver schedules a
 * session on a chapter; students book seats with coins (held); the solver
 * speaks and shares, students listen and raise a hand for the mic. Held →
 * the solver is paid per seat; solver no-show or cut short → every seat back.
 */

import { findContactDetails } from "./ask-later-rules";

export const GROUP_MIN_MINUTES = 20;
export const GROUP_MAX_MINUTES = 45;
export const GROUP_MIN_SEATS = 2;
export const GROUP_MAX_SEATS = 15;
export const GROUP_MAX_PRICE = 1000;
/** Scheduled at least this far ahead, so students can find and book it. */
export const GROUP_MIN_LEAD_MS = 2 * 60 * 60_000;
/** And at most this far ahead. */
export const GROUP_MAX_LEAD_MS = 14 * 24 * 60 * 60_000;
/** Upcoming sessions one solver may have at a time. */
export const GROUP_MAX_UPCOMING = 3;
/** Students may cancel a seat (coins back) until this long before the start. */
export const SEAT_CANCEL_CUTOFF_MS = 60 * 60_000;
/** The room opens this long before the start. */
export const JOIN_EARLY_MS = 10 * 60_000;
/** A solver who has not joined this long after the start is a no-show. */
export const HOST_NO_SHOW_MS = 10 * 60_000;
/** The sweep ends a session this long after its planned end. */
export const OVERRUN_GRACE_MS = 5 * 60_000;

export type GroupInput = {
  subject: string;
  chapter: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  minutes: number;
  seats: number;
  priceCoins: number;
};

export function groupInputProblems(input: GroupInput, now: Date): string[] {
  const errors: string[] = [];
  const title = input.title?.trim() ?? "";
  const chapter = input.chapter?.trim() ?? "";
  const description = input.description?.trim() ?? "";
  if (title.length < 5 || title.length > 80) errors.push("Give the session a title of 5 to 80 characters.");
  if (chapter.length < 2 || chapter.length > 80) errors.push("Name the chapter it covers.");
  if (description.length > 500) errors.push("Keep the description under 500 characters.");
  const contact = findContactDetails(`${title} ${chapter} ${description}`);
  if (contact) errors.push(`Remove ${contact}: contact details are never shared on Origin NOW.`);
  if (!(input.startsAt instanceof Date) || Number.isNaN(input.startsAt.getTime())) errors.push("Pick a start date and time.");
  else {
    const lead = input.startsAt.getTime() - now.getTime();
    if (lead < GROUP_MIN_LEAD_MS) errors.push("Schedule it at least 2 hours ahead so students can book.");
    if (lead > GROUP_MAX_LEAD_MS) errors.push("Schedule it within the next 14 days.");
  }
  if (!Number.isInteger(input.minutes) || input.minutes < GROUP_MIN_MINUTES || input.minutes > GROUP_MAX_MINUTES) {
    errors.push(`A session lasts ${GROUP_MIN_MINUTES} to ${GROUP_MAX_MINUTES} minutes.`);
  }
  if (!Number.isInteger(input.seats) || input.seats < GROUP_MIN_SEATS || input.seats > GROUP_MAX_SEATS) {
    errors.push(`Seats must be ${GROUP_MIN_SEATS} to ${GROUP_MAX_SEATS}.`);
  }
  if (!Number.isInteger(input.priceCoins) || input.priceCoins < 1 || input.priceCoins > GROUP_MAX_PRICE) {
    errors.push(`The price per seat is 1 to ${GROUP_MAX_PRICE} coins.`);
  }
  return errors;
}

/** When the room is open to join: from 10 minutes before the start to the planned end plus the grace. */
export function joinWindow(startsAt: Date, minutes: number): { opens: Date; closes: Date } {
  return {
    opens: new Date(startsAt.getTime() - JOIN_EARLY_MS),
    closes: new Date(startsAt.getTime() + minutes * 60_000 + OVERRUN_GRACE_MS),
  };
}

export function canCancelSeat(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() - now.getTime() >= SEAT_CANCEL_CUTOFF_MS;
}

/**
 * Who gets the held coins when a session ends: the solver when they joined
 * and the session ran at least half its planned length; otherwise every
 * seat is refunded (no-show, or cut short).
 */
export function groupSettlement(input: { solverJoinedAt: Date | null; startedAt: Date | null; endedAt: Date; minutes: number }): "paid" | "refunded" {
  if (!input.solverJoinedAt || !input.startedAt) return "refunded";
  const ran = input.endedAt.getTime() - input.startedAt.getTime();
  return ran >= (input.minutes * 60_000) / 2 ? "paid" : "refunded";
}

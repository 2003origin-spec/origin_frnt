/**
 * Weekly roster (pilot readiness item 3, decision B82): which evenings a
 * solver says they will cover. Pure rules only — roster-service.ts does the
 * database work. All days are IST calendar days ("YYYY-MM-DD" keys).
 */

import type { OpenHours } from "./now-settings";

/** Solvers plan this many evenings ahead, today included. */
export const ROSTER_DAYS_AHEAD = 14;
/** The admin view also looks back this many evenings to see who came online. */
export const ROSTER_DAYS_BACK = 7;
/** Runbook evening checklist: at least two solvers online per pilot subject. */
export const MIN_COVER = 2;

const DAY_MS = 24 * 60 * 60_000;
const IST_OFFSET_MS = 5.5 * 60 * 60_000;

/** IST calendar day of an instant. */
export function istDay(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar day. */
export function weekdayOf(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00Z`).getUTCDay();
}

/** When the human shift starts on that IST day. */
export function shiftStart(dayKey: string, hours: OpenHours): Date {
  return new Date(`${dayKey}T${hours.from}:00+05:30`);
}

export type RosterDay = {
  day: string;
  weekday: number;
  /** Human hours run that weekday. */
  open: boolean;
  /** The solver may still change their slots for this day. */
  editable: boolean;
};

/** Today and the next days a solver can plan, each marked open / editable. */
export function rosterDays(now: Date, hours: OpenHours, count: number = ROSTER_DAYS_AHEAD): RosterDay[] {
  const today = istDay(now.getTime());
  return Array.from({ length: count }, (_, i) => {
    const day = addDays(today, i);
    const weekday = weekdayOf(day);
    const open = hours.from !== hours.to && hours.days.includes(weekday);
    return { day, weekday, open, editable: open && now < shiftStart(day, hours) };
  });
}

/** Why a slot cannot be changed, or null when it can. */
export function rosterEditBlock(dayKey: string, now: Date, hours: OpenHours): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || Number.isNaN(Date.parse(`${dayKey}T00:00:00Z`))) return "That is not a valid day.";
  const today = istDay(now.getTime());
  if (dayKey < today) return "That evening has passed.";
  if (dayKey > addDays(today, ROSTER_DAYS_AHEAD - 1)) return `You can plan up to ${ROSTER_DAYS_AHEAD} days ahead.`;
  const day = rosterDays(now, hours).find((d) => d.day === dayKey)!;
  if (!day.open) return "Live help is closed that day.";
  if (!day.editable) return "That shift has already started.";
  return null;
}

export type CoverLevel = "none" | "thin" | "ok";

export function coverLevel(solvers: number): CoverLevel {
  if (solvers <= 0) return "none";
  return solvers < MIN_COVER ? "thin" : "ok";
}

/** Length of the human shift in minutes (a window past midnight wraps; equal times = closed). */
export function shiftMinutes(hours: OpenHours): number {
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const from = toMinutes(hours.from);
  const to = toMinutes(hours.to);
  if (from === to) return 0;
  return from < to ? to - from : 24 * 60 - from + to;
}

/** When the human shift that opened on that IST day ends. */
export function shiftEnd(dayKey: string, hours: OpenHours): Date {
  return new Date(shiftStart(dayKey, hours).getTime() + shiftMinutes(hours) * 60_000);
}

/**
 * Pilot evening bonus (decision B84): online for at least the set share of
 * the shift, and — unless switched off — on the roster for that evening.
 */
export function earnsEveningBonus(input: {
  onlineMinutes: number;
  shiftMinutes: number;
  rostered: boolean;
  minOnlinePercent: number;
  requireRoster: boolean;
}): boolean {
  if (input.shiftMinutes <= 0) return false;
  if (input.requireRoster && !input.rostered) return false;
  return input.onlineMinutes * 100 >= input.minOnlinePercent * input.shiftMinutes;
}

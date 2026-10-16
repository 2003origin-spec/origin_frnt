/**
 * Origin NOW admin settings (plan doc, "Admin controls"). Scalars live in the
 * existing `app.platform_settings` key-value store under a `now_` prefix; lists
 * (prices, coin packs, promotions, store items) have their own tables.
 *
 * Parsing is pure and defensive: a malformed value falls back to the default
 * instead of breaking the feature, and the admin PUT validates before saving.
 * Every default marked PLACEHOLDER is a founder decision at sign-off.
 */

import { getSetting, setSetting } from "@/server/platform-settings";

import { DEFAULT_BOT_RULE, type BotRule } from "./matching";

export type OpenHours = {
  /** "HH:MM" in IST. */
  from: string;
  to: string;
  /** 0 = Sunday … 6 = Saturday, IST. */
  days: number[];
};

export type TransfersConfig = {
  enabled: boolean;
  dailyCap: number;
  minAccountAgeDays: number;
  kycRequired: boolean;
};

export type QuizConfig = {
  questions: number;
  minutes: number;
  passPercent: number;
};

export type NowSettings = {
  welcomeCoins: number;
  commissionBps: number;
  tipCap: number;
  openHours: OpenHours;
  bot: BotRule;
  transfers: TransfersConfig;
  quiz: QuizConfig;
  agreementVersion: string;
  recordingRetentionDays: number;
};

export const DEFAULT_NOW_SETTINGS: NowSettings = {
  welcomeCoins: 200, // PLACEHOLDER
  commissionBps: 0, // PLACEHOLDER
  tipCap: 50, // PLACEHOLDER
  openHours: { from: "18:00", to: "22:00", days: [0, 1, 2, 3, 4, 5, 6] },
  bot: DEFAULT_BOT_RULE,
  transfers: { enabled: false, dailyCap: 500, minAccountAgeDays: 30, kycRequired: true },
  quiz: { questions: 10, minutes: 15, passPercent: 70 },
  agreementVersion: "2026-10-draft",
  recordingRetentionDays: 30,
};

const KEYS = {
  welcomeCoins: "now_welcome_coins",
  commissionBps: "now_commission_bps",
  tipCap: "now_tip_cap",
  openHours: "now_open_hours",
  bot: "now_bot_rule",
  transfers: "now_transfers",
  quiz: "now_quiz",
  agreementVersion: "now_agreement_version",
  recordingRetentionDays: "now_recording_retention_days",
} as const satisfies Record<keyof NowSettings, string>;

function parseInteger(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw == null) return fallback;
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function parseJson<T>(raw: string | null): Partial<T> | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Partial<T>) : null;
  } catch {
    return null;
  }
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateOpenHours(value: OpenHours): string[] {
  const errors: string[] = [];
  if (!HHMM.test(value.from)) errors.push("Open-from must be HH:MM (24-hour).");
  if (!HHMM.test(value.to)) errors.push("Open-to must be HH:MM (24-hour).");
  if (!Array.isArray(value.days) || value.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    errors.push("Days must be numbers 0 (Sunday) to 6 (Saturday).");
  }
  return errors;
}

export function parseOpenHours(raw: string | null): OpenHours {
  const parsed = parseJson<OpenHours>(raw);
  if (!parsed) return DEFAULT_NOW_SETTINGS.openHours;
  const candidate: OpenHours = {
    from: typeof parsed.from === "string" ? parsed.from : DEFAULT_NOW_SETTINGS.openHours.from,
    to: typeof parsed.to === "string" ? parsed.to : DEFAULT_NOW_SETTINGS.openHours.to,
    days: Array.isArray(parsed.days) ? parsed.days : DEFAULT_NOW_SETTINGS.openHours.days,
  };
  return validateOpenHours(candidate).length === 0 ? candidate : DEFAULT_NOW_SETTINGS.openHours;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * True when `now` falls inside human open hours, evaluated in IST. A window
 * that crosses midnight (e.g. 22:00–02:00) belongs to the day it opened on.
 */
export function isWithinOpenHours(hours: OpenHours, now: Date): boolean {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60_000);
  const day = ist.getUTCDay();
  const minute = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const from = minutesOf(hours.from);
  const to = minutesOf(hours.to);
  if (from === to) return false;
  if (from < to) return hours.days.includes(day) && minute >= from && minute < to;
  if (minute >= from) return hours.days.includes(day);
  const yesterday = (day + 6) % 7;
  return minute < to && hours.days.includes(yesterday);
}

export function parseBotRule(raw: string | null): BotRule {
  const parsed = parseJson<BotRule>(raw);
  if (!parsed) return DEFAULT_NOW_SETTINGS.bot;
  const nullableCount = (v: unknown, fallback: number | null) =>
    v === null ? null : Number.isInteger(v) && (v as number) >= 0 ? (v as number) : fallback;
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_BOT_RULE.enabled,
    whenNoneOnline: typeof parsed.whenNoneOnline === "boolean" ? parsed.whenNoneOnline : DEFAULT_BOT_RULE.whenNoneOnline,
    afterFailedOffers: nullableCount(parsed.afterFailedOffers, DEFAULT_BOT_RULE.afterFailedOffers),
    afterMs: nullableCount(parsed.afterMs, DEFAULT_BOT_RULE.afterMs),
    disabledSubjects: Array.isArray(parsed.disabledSubjects)
      ? [...new Set(parsed.disabledSubjects.map((s) => String(s).trim().toLowerCase()))].filter((s) =>
          ["physics", "chemistry", "mathematics", "biology"].includes(s),
        )
      : [],
  };
}

export function parseTransfers(raw: string | null): TransfersConfig {
  const parsed = parseJson<TransfersConfig>(raw);
  const d = DEFAULT_NOW_SETTINGS.transfers;
  if (!parsed) return d;
  return {
    enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : d.enabled,
    dailyCap: Number.isInteger(parsed.dailyCap) && (parsed.dailyCap as number) >= 0 ? (parsed.dailyCap as number) : d.dailyCap,
    minAccountAgeDays:
      Number.isInteger(parsed.minAccountAgeDays) && (parsed.minAccountAgeDays as number) >= 0
        ? (parsed.minAccountAgeDays as number)
        : d.minAccountAgeDays,
    kycRequired: typeof parsed.kycRequired === "boolean" ? parsed.kycRequired : d.kycRequired,
  };
}

export function parseQuiz(raw: string | null): QuizConfig {
  const parsed = parseJson<QuizConfig>(raw);
  const d = DEFAULT_NOW_SETTINGS.quiz;
  if (!parsed) return d;
  const pick = (v: unknown, fallback: number, min: number, max: number) =>
    Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : fallback;
  return {
    questions: pick(parsed.questions, d.questions, 3, 50),
    minutes: pick(parsed.minutes, d.minutes, 3, 120),
    passPercent: pick(parsed.passPercent, d.passPercent, 1, 100),
  };
}

export async function getNowSettings(): Promise<NowSettings> {
  const [welcome, commission, tipCap, openHours, bot, transfers, quiz, agreement, retention] = await Promise.all([
    getSetting(KEYS.welcomeCoins),
    getSetting(KEYS.commissionBps),
    getSetting(KEYS.tipCap),
    getSetting(KEYS.openHours),
    getSetting(KEYS.bot),
    getSetting(KEYS.transfers),
    getSetting(KEYS.quiz),
    getSetting(KEYS.agreementVersion),
    getSetting(KEYS.recordingRetentionDays),
  ]);
  const d = DEFAULT_NOW_SETTINGS;
  return {
    welcomeCoins: parseInteger(welcome, d.welcomeCoins, 0, 1_000_000),
    commissionBps: parseInteger(commission, d.commissionBps, 0, 10_000),
    tipCap: parseInteger(tipCap, d.tipCap, 0, 1_000_000),
    openHours: parseOpenHours(openHours),
    bot: parseBotRule(bot),
    transfers: parseTransfers(transfers),
    quiz: parseQuiz(quiz),
    agreementVersion: agreement?.trim() || d.agreementVersion,
    recordingRetentionDays: parseInteger(retention, d.recordingRetentionDays, 1, 3650),
  };
}

/** Validates a partial update; returns errors or the serialised key/value pairs to save. */
export function prepareSettingsUpdate(
  patch: Partial<NowSettings>,
): { ok: true; pairs: [string, string][] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const pairs: [string, string][] = [];
  const intField = (key: "welcomeCoins" | "commissionBps" | "tipCap" | "recordingRetentionDays", min: number, max: number) => {
    const v = patch[key];
    if (v === undefined) return;
    if (!Number.isInteger(v) || v < min || v > max) errors.push(`${key} must be a whole number from ${min} to ${max}.`);
    else pairs.push([KEYS[key], String(v)]);
  };
  intField("welcomeCoins", 0, 1_000_000);
  intField("commissionBps", 0, 10_000);
  intField("tipCap", 0, 1_000_000);
  intField("recordingRetentionDays", 1, 3650);
  if (patch.openHours) {
    const e = validateOpenHours(patch.openHours);
    if (e.length) errors.push(...e);
    else pairs.push([KEYS.openHours, JSON.stringify(patch.openHours)]);
  }
  if (patch.bot) pairs.push([KEYS.bot, JSON.stringify(parseBotRule(JSON.stringify(patch.bot)))]);
  if (patch.transfers) pairs.push([KEYS.transfers, JSON.stringify(parseTransfers(JSON.stringify(patch.transfers)))]);
  if (patch.quiz) pairs.push([KEYS.quiz, JSON.stringify(parseQuiz(JSON.stringify(patch.quiz)))]);
  if (patch.agreementVersion !== undefined) {
    const v = String(patch.agreementVersion).trim();
    if (!v || v.length > 40) errors.push("agreementVersion must be 1 to 40 characters.");
    else pairs.push([KEYS.agreementVersion, v]);
  }
  return errors.length ? { ok: false, errors } : { ok: true, pairs };
}

export async function saveNowSettings(pairs: readonly [string, string][], updatedBy: string): Promise<void> {
  for (const [key, value] of pairs) await setSetting(key, value, updatedBy);
}

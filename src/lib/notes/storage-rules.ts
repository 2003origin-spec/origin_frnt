/**
 * Origin Notes — My Notes storage rules (V1/NOTES_PLAN.md §6 Settings, §8).
 *
 * Pure functions (no I/O) so the limit maths is unit-tested: which limit
 * applies, the admin settings with their defaults and bounds, per-kind file
 * size caps, the 80 % / 100 % warning levels and when a Bin item expires.
 */

import type { NotesFileKind } from "./file-types";

export const MB = 1024 * 1024;
export const GB = 1024 * MB;

/** Kinds a student can upload to My Notes (typed notes are written, not uploaded). */
export const PERSONAL_UPLOAD_KINDS: readonly NotesFileKind[] = ["pdf", "image", "office", "audio", "video"];

export type MyFileKind = "typed" | NotesFileKind;

/** Typed notes: 200 KB of text (plan §8 table). */
export const TYPED_NOTE_MAX_BYTES = 200 * 1024;
/**
 * …and at most 200,000 characters: the database's CHECK (char_length(body_md)
 * <= 200000). Mostly-ASCII notes of 200,001–204,800 chars passed the byte check
 * and then failed the insert as a generic 500.
 */
export const TYPED_NOTE_MAX_CHARS = 200_000;
export const MY_FOLDER_MAX_DEPTH = 8;
export const VOICE_MAX_SECONDS = 15 * 60;
/** Photos are shrunk on the phone to this long side before upload. */
export const PHOTO_MAX_SIDE = 2000;

export type NotesSettings = {
  freeLimitBytes: number;
  premiumLimitBytes: number;
  maxFileBytes: number;
  maxVideoBytes: number;
  allowedKinds: NotesFileKind[];
  uploadsEnabled: boolean;
  sharingEnabled: boolean;
  binDays: number;
};

export const DEFAULT_NOTES_SETTINGS: NotesSettings = {
  freeLimitBytes: 100 * MB,
  premiumLimitBytes: 1 * GB,
  maxFileBytes: 25 * MB,
  maxVideoBytes: 100 * MB,
  allowedKinds: [...PERSONAL_UPLOAD_KINDS],
  uploadsEnabled: true,
  sharingEnabled: true,
  binDays: 30,
};

/** Keys in app.platform_settings. */
export const NOTES_SETTING_KEYS: Record<keyof NotesSettings, string> = {
  freeLimitBytes: "notes_free_limit_bytes",
  premiumLimitBytes: "notes_premium_limit_bytes",
  maxFileBytes: "notes_max_file_bytes",
  maxVideoBytes: "notes_max_video_bytes",
  allowedKinds: "notes_allowed_kinds",
  uploadsEnabled: "notes_uploads_enabled",
  sharingEnabled: "notes_sharing_enabled",
  binDays: "notes_bin_days",
};

/** Bounds the admin form and the server both enforce. */
export const NOTES_SETTING_BOUNDS = {
  limitBytes: { min: 0, max: 50 * GB },
  maxFileBytes: { min: 1 * MB, max: 200 * MB },
  maxVideoBytes: { min: 1 * MB, max: 500 * MB },
  binDays: { min: 1, max: 90 },
} as const;

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readInt(raw: string | null | undefined, fallback: number, min: number, max: number): number {
  if (raw === null || raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? clampInt(n, min, max) : fallback;
}

function readBool(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === null || raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(value)) return true;
  if (["0", "false", "off", "no"].includes(value)) return false;
  return fallback;
}

function readKinds(raw: string | null | undefined): NotesFileKind[] {
  if (raw === null || raw === undefined) return [...DEFAULT_NOTES_SETTINGS.allowedKinds];
  const picked = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is NotesFileKind => (PERSONAL_UPLOAD_KINDS as readonly string[]).includes(part));
  return PERSONAL_UPLOAD_KINDS.filter((kind) => picked.includes(kind));
}

/** Stored strings → settings. Anything missing or broken falls back to the default. */
export function parseNotesSettings(raw: Partial<Record<string, string | null>>): NotesSettings {
  const b = NOTES_SETTING_BOUNDS;
  const d = DEFAULT_NOTES_SETTINGS;
  return {
    freeLimitBytes: readInt(raw[NOTES_SETTING_KEYS.freeLimitBytes], d.freeLimitBytes, b.limitBytes.min, b.limitBytes.max),
    premiumLimitBytes: readInt(raw[NOTES_SETTING_KEYS.premiumLimitBytes], d.premiumLimitBytes, b.limitBytes.min, b.limitBytes.max),
    maxFileBytes: readInt(raw[NOTES_SETTING_KEYS.maxFileBytes], d.maxFileBytes, b.maxFileBytes.min, b.maxFileBytes.max),
    maxVideoBytes: readInt(raw[NOTES_SETTING_KEYS.maxVideoBytes], d.maxVideoBytes, b.maxVideoBytes.min, b.maxVideoBytes.max),
    allowedKinds: readKinds(raw[NOTES_SETTING_KEYS.allowedKinds]),
    uploadsEnabled: readBool(raw[NOTES_SETTING_KEYS.uploadsEnabled], d.uploadsEnabled),
    sharingEnabled: readBool(raw[NOTES_SETTING_KEYS.sharingEnabled], d.sharingEnabled),
    binDays: readInt(raw[NOTES_SETTING_KEYS.binDays], d.binDays, b.binDays.min, b.binDays.max),
  };
}

/** Problems with an admin's proposed settings, in plain words (empty = fine). */
export function checkNotesSettings(settings: NotesSettings): string[] {
  const b = NOTES_SETTING_BOUNDS;
  const problems: string[] = [];
  const within = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
  if (!within(settings.freeLimitBytes, b.limitBytes.min, b.limitBytes.max)) problems.push("The free limit must be between 0 and 50 GB.");
  if (!within(settings.premiumLimitBytes, b.limitBytes.min, b.limitBytes.max)) problems.push("The premium limit must be between 0 and 50 GB.");
  if (settings.premiumLimitBytes < settings.freeLimitBytes) problems.push("The premium limit can't be smaller than the free limit.");
  if (!within(settings.maxFileBytes, b.maxFileBytes.min, b.maxFileBytes.max)) problems.push("The largest file must be between 1 MB and 200 MB.");
  if (!within(settings.maxVideoBytes, b.maxVideoBytes.min, b.maxVideoBytes.max)) problems.push("The largest video must be between 1 MB and 500 MB.");
  if (!within(settings.binDays, b.binDays.min, b.binDays.max)) problems.push("Bin days must be between 1 and 90.");
  return problems;
}

/** Settings → the strings stored in app.platform_settings. */
export function serialiseNotesSettings(settings: NotesSettings): Record<string, string> {
  return {
    [NOTES_SETTING_KEYS.freeLimitBytes]: String(settings.freeLimitBytes),
    [NOTES_SETTING_KEYS.premiumLimitBytes]: String(settings.premiumLimitBytes),
    [NOTES_SETTING_KEYS.maxFileBytes]: String(settings.maxFileBytes),
    [NOTES_SETTING_KEYS.maxVideoBytes]: String(settings.maxVideoBytes),
    [NOTES_SETTING_KEYS.allowedKinds]: settings.allowedKinds.join(","),
    [NOTES_SETTING_KEYS.uploadsEnabled]: settings.uploadsEnabled ? "true" : "false",
    [NOTES_SETTING_KEYS.sharingEnabled]: settings.sharingEnabled ? "true" : "false",
    [NOTES_SETTING_KEYS.binDays]: String(settings.binDays),
  };
}

/**
 * Which limit applies (plan §8): a personal limit set by an admin, else the
 * premium limit when the student owns any premium subject, else the free one.
 */
export function effectiveLimitBytes(input: { overrideBytes: number | null; premium: boolean; settings: NotesSettings }): number {
  if (input.overrideBytes !== null && input.overrideBytes >= 0) return input.overrideBytes;
  return input.premium ? input.settings.premiumLimitBytes : input.settings.freeLimitBytes;
}

export function maxBytesForKind(kind: NotesFileKind, settings: NotesSettings): number {
  return kind === "video" ? settings.maxVideoBytes : settings.maxFileBytes;
}

/** True when `extra` more bytes fit. Reservations count, so parallel uploads can't overshoot. */
export function fitsInLimit(input: { usedBytes: number; reservedBytes: number; extraBytes: number; limitBytes: number }): boolean {
  return input.usedBytes + input.reservedBytes + input.extraBytes <= input.limitBytes;
}

export type StorageLevel = "ok" | "warn" | "full";

/** Warn at 80 %, full at 100 % (plan §3). A 0-byte limit is always full. */
export function storageLevel(usedBytes: number, limitBytes: number): StorageLevel {
  if (limitBytes <= 0 || usedBytes >= limitBytes) return "full";
  return usedBytes >= limitBytes * 0.8 ? "warn" : "ok";
}

export function storagePercent(usedBytes: number, limitBytes: number): number {
  if (limitBytes <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((usedBytes / limitBytes) * 100)));
}

/** UTF-8 size of a typed note's text. */
export function typedNoteBytes(body: string): number {
  return new TextEncoder().encode(body).length;
}

/** Every typed note costs at least this much, so empty notes can't be added for free. */
export const TYPED_NOTE_MIN_BYTES = 1024;

/** What a typed note counts towards storage: its UTF-8 size, at least 1 KB. */
export function billedTypedNoteBytes(body: string): number {
  return Math.max(TYPED_NOTE_MIN_BYTES, typedNoteBytes(body));
}

/** Most files and folders one student can keep (Bin included), so nobody can flood the tables. */
export const MAX_MY_FILES = 5000;
export const MAX_MY_FOLDERS = 1000;

/** When a Bin item is removed for good. */
export function binExpiresAt(deletedAt: Date, binDays: number): Date {
  return new Date(deletedAt.getTime() + binDays * 24 * 60 * 60 * 1000);
}

export const STORAGE_FULL_MESSAGE = "Storage full: delete something, empty the Bin, or ask for more space.";

/** True when a typed note is over either limit (bytes, or the database's character cap). */
export function typedNoteTooLong(body: string): boolean {
  return body.length > TYPED_NOTE_MAX_CHARS || typedNoteBytes(body) > TYPED_NOTE_MAX_BYTES;
}

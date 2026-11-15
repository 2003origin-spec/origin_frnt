/**
 * Study Music — the pure, client-safe rules (V1/STUDY_MUSIC_PLAN.md §4).
 *
 * Moods, limits, licence presets and the parsers every door uses: the admin
 * API, the student API (website + app) and, later, both players. No server
 * imports, no Node APIs, so the browser can use the same checks before it
 * uploads. Every parser returns `{ ok: true, value }` or `{ ok: false, error }`
 * with an error written for people; nothing here throws.
 *
 * Unit tests: tests/unit/study-music-rules.test.ts, study-music-licence.test.ts,
 * study-music-keys.test.ts.
 */

export const MUSIC_MOODS = ["lofi", "instrumental", "nature", "white_noise"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export const MUSIC_MOOD_LABELS: Record<MusicMood, string> = {
  lofi: "Lo-fi",
  instrumental: "Instrumental",
  nature: "Nature",
  white_noise: "White noise",
};

export const MUSIC_TRACK_STATUSES = ["draft", "published", "retired"] as const;
export type MusicTrackStatus = (typeof MUSIC_TRACK_STATUSES)[number];

export const MUSIC_PLATFORMS = ["web", "android"] as const;
export type MusicPlatform = (typeof MUSIC_PLATFORMS)[number];

/** Limits shared with the `music` schema CHECKs (tests pin the two together). */
export const MUSIC_TITLE_MAX = 80;
export const MUSIC_ARTIST_MAX = 80;
export const MUSIC_LICENCE_NAME_MAX = 80;
export const MUSIC_URL_MAX = 500;
export const MUSIC_ATTRIBUTION_MAX = 300;
export const MUSIC_DURATION_MIN_S = 20;
export const MUSIC_DURATION_MAX_S = 1200;
/** 15 MB: about 20 minutes of AAC at 96 kbps. */
export const MUSIC_AUDIO_MAX_BYTES = 15 * 1024 * 1024;
/** Licence proof: a screenshot or PDF of the source page, 5 MB. */
export const MUSIC_PROOF_MAX_BYTES = 5 * 1024 * 1024;
export const MUSIC_SORT_ORDER_MAX = 100_000;
/** One listening session can't claim more than a day. */
export const MUSIC_LISTEN_SECONDS_MAX = 24 * 60 * 60;
/** How far back a device may date a session it queued offline. */
export const MUSIC_LISTEN_BACKDATE_MAX_MS = 24 * 60 * 60 * 1000;

/** Signed-link lifetimes (seconds). */
export const MUSIC_PLAY_LINK_SECONDS = 3600;
export const MUSIC_PREVIEW_LINK_SECONDS = 300;
export const MUSIC_UPLOAD_LINK_SECONDS = 600;
/** Signed play links per user per hour. */
export const MUSIC_PLAY_LINKS_PER_HOUR = 300;

export const MUSIC_AUDIO_TYPES = {
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
} as const;
export type MusicAudioMime = keyof typeof MUSIC_AUDIO_TYPES;

export const MUSIC_PROOF_TYPES = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
} as const;
export type MusicProofMime = keyof typeof MUSIC_PROOF_TYPES;

export type MusicUploadKind = "audio" | "proof";

/**
 * Licence dropdown on the admin page. `url` pre-fills the licence link (empty
 * means the admin types it). Only licences that allow re-distributing the file
 * unchanged in a player belong here (plan §2): never NC, ND, SA or Pixabay.
 */
export const MUSIC_LICENCE_PRESETS = [
  { name: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", attributionRequired: false },
  { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", attributionRequired: true },
  { name: "Made by Origin", url: "https://www.o3origin.com/", attributionRequired: false },
  {
    name: "TunePocket App Streaming",
    url: "https://www.tunepocket.com/can-i-legally-stream-royalty-free-music-and-sound-effects-in-my-app/",
    attributionRequired: false,
  },
] as const;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
// C0/C1 control characters (tab and newline included: every field is one line).
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;

export function isMusicMood(value: unknown): value is MusicMood {
  return typeof value === "string" && (MUSIC_MOODS as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256.test(value);
}

export function isMusicAudioMime(value: unknown): value is MusicAudioMime {
  return typeof value === "string" && Object.hasOwn(MUSIC_AUDIO_TYPES, value);
}

export function isMusicProofMime(value: unknown): value is MusicProofMime {
  return typeof value === "string" && Object.hasOwn(MUSIC_PROOF_TYPES, value);
}

/** Length in characters as Postgres `char_length` counts them (code points). */
export function charLength(value: string): number {
  return [...value].length;
}

/** A trimmed one-line text of 1..max characters, else null. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || charLength(text) > max || CONTROL.test(text)) return null;
  return text;
}

/**
 * A link we only ever SHOW (never fetch): `https://` only, a real host, no
 * user:password part, at most 500 characters. Returns the text as typed
 * (trimmed), so what the admin pasted is what students see.
 */
export function cleanHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MUSIC_URL_MAX || CONTROL.test(text) || /\s/u.test(text)) return null;
  if (!text.toLowerCase().startsWith("https://")) return null;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
  // The DB CHECK is case-sensitive ('^https://'): store the scheme lower-case.
  return `https://${text.slice("https://".length)}`;
}

export function isWholeNumber(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

// ── Object keys (made by the server only) ────────────────────────────────────

const TRACK_KEY = /^music\/tracks\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(m4a|mp3)$/u;
const PROOF_KEY = /^music\/proof\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg)$/u;

/** The key for a new upload: `music/tracks/<uuid>.<ext>` or `music/proof/<uuid>.<ext>`. */
export function musicObjectKey(kind: MusicUploadKind, uuid: string, mime: MusicAudioMime | MusicProofMime): string {
  if (!isUuid(uuid)) throw new Error("A music object key needs a lower-case uuid.");
  if (kind === "audio") {
    if (!isMusicAudioMime(mime)) throw new Error("Not an audio type.");
    return `music/tracks/${uuid}.${MUSIC_AUDIO_TYPES[mime]}`;
  }
  if (!isMusicProofMime(mime)) throw new Error("Not a proof type.");
  return `music/proof/${uuid}.${MUSIC_PROOF_TYPES[mime]}`;
}

export function isMusicTrackKey(value: unknown): value is string {
  return typeof value === "string" && TRACK_KEY.test(value);
}

export function isMusicProofKey(value: unknown): value is string {
  return typeof value === "string" && PROOF_KEY.test(value);
}

/** The audio type a track key was made for (the server picked the extension from it). */
export function audioMimeForKey(key: string): MusicAudioMime | null {
  if (!isMusicTrackKey(key)) return null;
  return key.endsWith(".m4a") ? "audio/mp4" : "audio/mpeg";
}

export function proofMimeForKey(key: string): MusicProofMime | null {
  if (!isMusicProofKey(key)) return null;
  if (key.endsWith(".pdf")) return "application/pdf";
  if (key.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

// ── Magic bytes ──────────────────────────────────────────────────────────────

/**
 * True when the first bytes look like the declared audio type: an MP4
 * container (`ftyp` box at offset 4) for audio/mp4, an ID3 tag or an MPEG
 * frame sync for audio/mpeg.
 */
export function looksLikeAudio(bytes: Uint8Array, mime: MusicAudioMime): boolean {
  if (mime === "audio/mp4") {
    return bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true; // "ID3"
  // Frame sync: 11 set bits; MPEG version and layer not "reserved".
  return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x18) !== 0x08 && (bytes[1] & 0x06) !== 0;
}

export function looksLikeProof(bytes: Uint8Array, mime: MusicProofMime): boolean {
  if (mime === "application/pdf") {
    return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  }
  if (mime === "image/png") {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return bytes.length >= 8 && sig.every((b, i) => bytes[i] === b);
  }
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

// ── Admin: presign ───────────────────────────────────────────────────────────

export type PresignInput = { kind: MusicUploadKind; contentType: MusicAudioMime | MusicProofMime; size: number };

export function parsePresignInput(body: Record<string, unknown>): ParseResult<PresignInput> {
  const kind = body.kind;
  if (kind !== "audio" && kind !== "proof") return { ok: false, error: "Choose what you are uploading: audio or proof." };
  const contentType = typeof body.contentType === "string" ? body.contentType.trim().toLowerCase() : "";
  if (kind === "audio" && !isMusicAudioMime(contentType)) {
    return { ok: false, error: "Upload an .m4a (AAC) or .mp3 file. Run scripts/music-prepare.sh first." };
  }
  if (kind === "proof" && !isMusicProofMime(contentType)) {
    return { ok: false, error: "Licence proof must be a PDF, PNG or JPEG." };
  }
  const max = kind === "audio" ? MUSIC_AUDIO_MAX_BYTES : MUSIC_PROOF_MAX_BYTES;
  if (!isWholeNumber(body.size, 1, max)) {
    return { ok: false, error: kind === "audio" ? "Audio files must be 1 byte to 15 MB." : "Proof files must be 1 byte to 5 MB." };
  }
  return { ok: true, value: { kind, contentType: contentType as MusicAudioMime | MusicProofMime, size: body.size } };
}

// ── Admin: track fields ──────────────────────────────────────────────────────

export type MusicLicenceFields = {
  sourceUrl: string;
  licenceName: string;
  licenceUrl: string;
  attributionRequired: boolean;
  attributionText: string;
};

export type MusicTrackFields = MusicLicenceFields & {
  title: string;
  artist: string;
  mood: MusicMood;
  durationSeconds: number;
  loopable: boolean;
  allowOffline: boolean;
  sortOrder: number;
};

type FieldParser = (value: unknown) => { ok: true; value: unknown } | { ok: false; error: string };

const FIELD_PARSERS: Record<keyof MusicTrackFields, FieldParser> = {
  title: (v) => {
    const t = cleanText(v, MUSIC_TITLE_MAX);
    return t ? { ok: true, value: t } : { ok: false, error: `Title must be 1–${MUSIC_TITLE_MAX} characters on one line.` };
  },
  artist: (v) => {
    const t = cleanText(v, MUSIC_ARTIST_MAX);
    return t ? { ok: true, value: t } : { ok: false, error: `Artist must be 1–${MUSIC_ARTIST_MAX} characters on one line.` };
  },
  mood: (v) => (isMusicMood(v) ? { ok: true, value: v } : { ok: false, error: "Pick a mood: Lo-fi, Instrumental, Nature or White noise." }),
  durationSeconds: (v) =>
    isWholeNumber(v, MUSIC_DURATION_MIN_S, MUSIC_DURATION_MAX_S)
      ? { ok: true, value: v }
      : { ok: false, error: `Tracks must be ${MUSIC_DURATION_MIN_S} seconds to ${MUSIC_DURATION_MAX_S / 60} minutes long.` },
  loopable: (v) => (typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "Loopable must be on or off." }),
  allowOffline: (v) => (typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "Offline must be on or off." }),
  sortOrder: (v) =>
    isWholeNumber(v, 0, MUSIC_SORT_ORDER_MAX) ? { ok: true, value: v } : { ok: false, error: `Order must be a whole number from 0 to ${MUSIC_SORT_ORDER_MAX}.` },
  sourceUrl: (v) => {
    const u = cleanHttpsUrl(v);
    return u ? { ok: true, value: u } : { ok: false, error: "Source link must be an https:// link (up to 500 characters)." };
  },
  licenceName: (v) => {
    const t = cleanText(v, MUSIC_LICENCE_NAME_MAX);
    return t ? { ok: true, value: t } : { ok: false, error: `Licence name must be 1–${MUSIC_LICENCE_NAME_MAX} characters.` };
  },
  licenceUrl: (v) => {
    const u = cleanHttpsUrl(v);
    return u ? { ok: true, value: u } : { ok: false, error: "Licence link must be an https:// link (up to 500 characters)." };
  },
  attributionRequired: (v) =>
    typeof v === "boolean" ? { ok: true, value: v } : { ok: false, error: "Say whether the licence requires a credit." },
  attributionText: (v) => {
    // Kept exactly as typed (HTML included): every UI renders it as plain text.
    const t = cleanText(v, MUSIC_ATTRIBUTION_MAX);
    return t ? { ok: true, value: t } : { ok: false, error: `Credit text must be 1–${MUSIC_ATTRIBUTION_MAX} characters on one line.` };
  },
};

const OPTIONAL_DEFAULTS: Partial<MusicTrackFields> = { loopable: false, allowOffline: true, sortOrder: 0 };

/** Every field of a new track. Optional: loopable (false), allowOffline (true), sortOrder (0). */
export function parseTrackFields(body: Record<string, unknown>): ParseResult<MusicTrackFields> {
  const out: Record<string, unknown> = {};
  for (const [key, parse] of Object.entries(FIELD_PARSERS) as [keyof MusicTrackFields, FieldParser][]) {
    if (body[key] === undefined && key in OPTIONAL_DEFAULTS) {
      out[key] = OPTIONAL_DEFAULTS[key];
      continue;
    }
    const result = parse(body[key]);
    if (!result.ok) return result;
    out[key] = result.value;
  }
  return { ok: true, value: out as MusicTrackFields };
}

/** The fields present in an edit (at least one). The audio file itself never changes. */
export function parseTrackPatch(body: Record<string, unknown>): ParseResult<Partial<MusicTrackFields>> {
  const out: Record<string, unknown> = {};
  for (const [key, parse] of Object.entries(FIELD_PARSERS) as [keyof MusicTrackFields, FieldParser][]) {
    if (body[key] === undefined) continue;
    const result = parse(body[key]);
    if (!result.ok) return result;
    out[key] = result.value;
  }
  if (!Object.keys(out).length) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: out as Partial<MusicTrackFields> };
}

export const MUSIC_LICENCE_FIELD_LABELS: Record<keyof MusicLicenceFields, string> = {
  sourceUrl: "source link",
  licenceName: "licence name",
  licenceUrl: "licence link",
  attributionRequired: "credit required",
  attributionText: "credit text",
};

/**
 * The licence fields that are missing or invalid on a stored track — publish
 * is refused unless this is empty. Re-checked at publish time even though the
 * columns are NOT NULL, because a row edited by hand on Neon could hold blanks.
 */
export function missingLicenceFields(track: Partial<Record<keyof MusicLicenceFields, unknown>>): (keyof MusicLicenceFields)[] {
  const missing: (keyof MusicLicenceFields)[] = [];
  if (!cleanHttpsUrl(track.sourceUrl)) missing.push("sourceUrl");
  if (!cleanText(track.licenceName, MUSIC_LICENCE_NAME_MAX)) missing.push("licenceName");
  if (!cleanHttpsUrl(track.licenceUrl)) missing.push("licenceUrl");
  if (typeof track.attributionRequired !== "boolean") missing.push("attributionRequired");
  if (!cleanText(track.attributionText, MUSIC_ATTRIBUTION_MAX)) missing.push("attributionText");
  return missing;
}

// ── Student: prefs and listening ─────────────────────────────────────────────

export type MusicPrefs = { pauseDuringTests: boolean; defaultMood: MusicMood };
export const DEFAULT_MUSIC_PREFS: MusicPrefs = { pauseDuringTests: true, defaultMood: "lofi" };

export function parsePrefsInput(body: Record<string, unknown>): ParseResult<Partial<MusicPrefs>> {
  const out: Partial<MusicPrefs> = {};
  if (body.pauseDuringTests !== undefined) {
    if (typeof body.pauseDuringTests !== "boolean") return { ok: false, error: "pauseDuringTests must be true or false." };
    out.pauseDuringTests = body.pauseDuringTests;
  }
  if (body.defaultMood !== undefined) {
    if (!isMusicMood(body.defaultMood)) return { ok: false, error: "Unknown mood." };
    out.defaultMood = body.defaultMood;
  }
  if (!Object.keys(out).length) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: out };
}

export type ListenInput = {
  sessionId: string;
  trackId: string;
  seconds: number;
  focusSeconds: number;
  /** When the session began on the device (ISO); null = now. Clamped by the server. */
  startedAt: Date | null;
};

export function parseListenInput(body: Record<string, unknown>, now = Date.now()): ParseResult<ListenInput> {
  if (!isUuid(body.sessionId)) return { ok: false, error: "sessionId must be a uuid." };
  if (!isUuid(body.trackId)) return { ok: false, error: "trackId must be a uuid." };
  if (!isWholeNumber(body.seconds, 0, MUSIC_LISTEN_SECONDS_MAX)) return { ok: false, error: "seconds must be a whole number from 0." };
  if (!isWholeNumber(body.focusSeconds, 0, MUSIC_LISTEN_SECONDS_MAX)) return { ok: false, error: "focusSeconds must be a whole number from 0." };
  let startedAt: Date | null = null;
  if (body.startedAt !== undefined && body.startedAt !== null) {
    const ms = typeof body.startedAt === "string" ? Date.parse(body.startedAt) : NaN;
    if (!Number.isFinite(ms)) return { ok: false, error: "startedAt must be a date." };
    // Never in the future, never more than a day back.
    startedAt = new Date(Math.min(now, Math.max(now - MUSIC_LISTEN_BACKDATE_MAX_MS, ms)));
  }
  return {
    ok: true,
    value: {
      sessionId: body.sessionId,
      trackId: body.trackId,
      seconds: body.seconds,
      focusSeconds: Math.min(body.focusSeconds, body.seconds),
      startedAt,
    },
  };
}

/** "Music today: 42 min · 30 min in focus" */
export function formatMusicToday(today: { seconds: number; focusSeconds: number }): string {
  const minutes = (s: number) => Math.floor(Math.max(0, s) / 60);
  return `Music today: ${minutes(today.seconds)} min · ${minutes(today.focusSeconds)} min in focus`;
}

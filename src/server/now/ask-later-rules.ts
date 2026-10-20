/**
 * "Ask later" (decision B94) — pure rules: help without a live call. A
 * student posts a doubt (note + up to 3 photos), coins are held; a solver
 * claims it for a while and answers in writing (+ up to 3 photos); the
 * student accepts (rating, tip) or reports; unanswered in time → coins back.
 */

export type AskLaterConfig = {
  /** A doubt must be answered within this many hours of posting. */
  answerHours: number;
  /** A claim lasts this long; then the doubt goes back to the queue. */
  claimMinutes: number;
  /** Price as a share of the live human price for the difficulty. */
  pricePercent: number;
  /** An answer the student neither accepts nor reports is accepted after this long. */
  autoAcceptHours: number;
  /** Open (not yet settled) doubts a student may have at once. */
  maxOpenPerStudent: number;
};

export const DEFAULT_ASK_LATER: AskLaterConfig = {
  answerHours: 12,
  claimMinutes: 30,
  pricePercent: 60, // PLACEHOLDER: founders set it
  autoAcceptHours: 48,
  maxOpenPerStudent: 3,
};

const LIMITS: Record<keyof AskLaterConfig, [number, number]> = {
  answerHours: [1, 72],
  claimMinutes: [10, 120],
  pricePercent: [10, 200],
  autoAcceptHours: [12, 168],
  maxOpenPerStudent: [1, 10],
};

export function parseAskLaterConfig(raw: string | null): AskLaterConfig {
  let parsed: Partial<Record<keyof AskLaterConfig, unknown>> = {};
  try {
    parsed = raw ? (JSON.parse(raw) as typeof parsed) ?? {} : {};
  } catch {
    parsed = {};
  }
  const out = { ...DEFAULT_ASK_LATER };
  for (const key of Object.keys(LIMITS) as (keyof AskLaterConfig)[]) {
    const v = parsed[key];
    const [min, max] = LIMITS[key];
    if (Number.isInteger(v) && (v as number) >= min && (v as number) <= max) out[key] = v as number;
  }
  return out;
}

export function validateAskLaterConfig(value: Partial<AskLaterConfig>): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(LIMITS) as (keyof AskLaterConfig)[]) {
    const v = value[key];
    if (v === undefined) continue;
    const [min, max] = LIMITS[key];
    if (!Number.isInteger(v) || v < min || v > max) errors.push(`Ask later ${key} must be a whole number from ${min} to ${max}.`);
  }
  return errors;
}

/** The ask-later price from the live human price (never below 1 coin). */
export function askLaterPrice(liveHumanPrice: number, pricePercent: number): number {
  return Math.max(1, Math.round((liveHumanPrice * pricePercent) / 100));
}

/**
 * Contact details in a note or an answer (PRD trust & safety: no private
 * contact exchange). Returns what was found, or null. Deliberately strict:
 * a false alarm costs a rephrase, a miss can cost a child's safety.
 */
export function findContactDetails(text: string): string | null {
  const t = text.toLowerCase();
  if (/[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+/.test(t)) return "an email address";
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|net|org|me|io|co|ly|gg|app)\b)/.test(t)) return "a link";
  if (/\b(whats\s?app|wa\.me|telegram|t\.me|insta(gram)?|snap(chat)?|discord|signal\s?app|facebook|fb\.com)\b/.test(t)) {
    return "a messaging or social app";
  }
  // Ten or more digits close together (allowing spaces, dots and dashes): a phone number.
  const digitRuns = t.match(/(?:\+?\d[\s.-]?){10,}/g) ?? [];
  if (digitRuns.some((run) => run.replace(/\D/g, "").length >= 10)) return "a phone number";
  if (/(^|\s)@[a-z0-9_.]{3,}/.test(t)) return "a social handle";
  return null;
}

export const NOTE_MAX = 1000;
export const ANSWER_MIN = 20;
export const ANSWER_MAX = 4000;
export const MAX_PHOTOS = 3;
export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Problems with a student's note, or an empty list. */
export function noteProblems(note: string): string[] {
  if (note.length > NOTE_MAX) return [`Keep the note under ${NOTE_MAX} characters.`];
  const contact = findContactDetails(note);
  return contact ? [`Remove ${contact}: contact details are never shared on Origin NOW.`] : [];
}

/** Problems with a solver's answer, or an empty list. */
export function answerProblems(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length < ANSWER_MIN) return [`Write at least ${ANSWER_MIN} characters, the steps the student needs.`];
  if (trimmed.length > ANSWER_MAX) return [`Keep the answer under ${ANSWER_MAX} characters.`];
  const contact = findContactDetails(trimmed);
  return contact ? [`Remove ${contact}: contact details are never shared on Origin NOW.`] : [];
}

/** Photo keys must be this person's own uploads under the expected prefix, at most three. */
export function photoKeysProblem(keys: readonly string[], prefix: string): string | null {
  if (keys.length > MAX_PHOTOS) return `At most ${MAX_PHOTOS} photos.`;
  if (new Set(keys).size !== keys.length) return "The same photo is attached twice.";
  const ok = keys.every((k) => k.startsWith(prefix) && /^[A-Za-z0-9/_.-]+$/.test(k) && /\.(jpg|png|webp)$/.test(k) && !k.includes(".."));
  return ok ? null : "A photo does not belong to this doubt.";
}

export type AskLaterStatus = "open" | "claimed" | "answered" | "accepted" | "disputed" | "expired" | "cancelled";

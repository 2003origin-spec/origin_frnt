/**
 * Admin announcements — pure, client-safe rules shared by the admin page and
 * the server (src/server/announcements/*). No server imports here.
 *
 * An announcement is a short title + text + an internal link, sent to a group
 * of students as an in-app notification (the bell) and, for students with the
 * app, a phone notification. Plan: V1/ADMIN_ANNOUNCEMENTS_PLAN.md.
 *
 * Lengths are counted in characters as Postgres counts them (code points), so
 * an emoji is 1, the same as the `char_length` CHECKs in the migration.
 */

export const ANNOUNCEMENT_TITLE_MAX = 65;
export const ANNOUNCEMENT_BODY_MAX = 240;
export const ANNOUNCEMENT_LINK_MAX = 200;
export const ANNOUNCEMENT_DEFAULT_LINK = "/";

/** Classes as `origin_users.student_class` stores them (onboarding + profile). */
export const ANNOUNCEMENT_CLASSES = ["9", "10", "11", "12", "dropper"] as const;
export type AnnouncementClass = (typeof ANNOUNCEMENT_CLASSES)[number];

export const ANNOUNCEMENT_EXAMS = ["jee", "neet"] as const;
export type AnnouncementExam = (typeof ANNOUNCEMENT_EXAMS)[number];

/**
 * Who gets an announcement.
 *   students — every active student account, optionally narrowed by class,
 *              exam and/or Premium (filters combine with AND).
 *   me       — only the sending admin's own account (a test send).
 */
export type AnnouncementAudience =
  | {
      kind: "students";
      studentClass: AnnouncementClass | null;
      exam: AnnouncementExam | null;
      premiumOnly: boolean;
    }
  | { kind: "me" };

export const ALL_STUDENTS: AnnouncementAudience = { kind: "students", studentClass: null, exam: null, premiumOnly: false };

/** Character count the way Postgres `char_length` counts (code points). */
export function charCount(text: string): number {
  return [...text].length;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
}

/**
 * True for a path inside this site: starts with one "/", no scheme, no
 * protocol-relative "//", no backslashes, no spaces or control characters.
 */
export function isSafeInternalLink(value: string): boolean {
  if (!value || value.length > ANNOUNCEMENT_LINK_MAX) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  return /^\/[A-Za-z0-9\-._~/?#&=%+,]*$/u.test(value) && !value.includes("\\");
}

/** Parse an audience from untrusted JSON. Returns null when it isn't valid. */
export function parseAudience(value: unknown): AnnouncementAudience | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind === "me") return { kind: "me" };
  if (raw.kind !== "students") return null;

  const studentClass = raw.studentClass ?? null;
  if (studentClass !== null && !(ANNOUNCEMENT_CLASSES as readonly unknown[]).includes(studentClass)) return null;
  const exam = raw.exam ?? null;
  if (exam !== null && !(ANNOUNCEMENT_EXAMS as readonly unknown[]).includes(exam)) return null;
  const premiumOnly = raw.premiumOnly ?? false;
  if (typeof premiumOnly !== "boolean") return null;

  return {
    kind: "students",
    studentClass: studentClass as AnnouncementClass | null,
    exam: exam as AnnouncementExam | null,
    premiumOnly,
  };
}

/** A stable key for an audience, used to spot the same announcement sent twice. */
export function audienceKey(audience: AnnouncementAudience): string {
  if (audience.kind === "me") return "me";
  return `students|${audience.studentClass ?? "*"}|${audience.exam ?? "*"}|${audience.premiumOnly ? "premium" : "*"}`;
}

const CLASS_LABEL: Record<AnnouncementClass, string> = {
  "9": "Class 9",
  "10": "Class 10",
  "11": "Class 11",
  "12": "Class 12",
  dropper: "Droppers",
};
const EXAM_LABEL: Record<AnnouncementExam, string> = { jee: "JEE", neet: "NEET" };

export function classLabel(value: AnnouncementClass): string {
  return CLASS_LABEL[value];
}
export function examLabel(value: AnnouncementExam): string {
  return EXAM_LABEL[value];
}

/** "All students", "Class 12 · NEET · Premium", "Test: only me". */
export function describeAudience(audience: AnnouncementAudience): string {
  if (audience.kind === "me") return "Test: only me";
  const parts = [
    audience.studentClass ? CLASS_LABEL[audience.studentClass] : null,
    audience.exam ? EXAM_LABEL[audience.exam] : null,
    audience.premiumOnly ? "Premium" : null,
  ].filter(Boolean);
  return parts.length === 0 ? "All students" : `Students: ${parts.join(" · ")}`;
}

export type AnnouncementDraft = { title: string; body: string; link: string };

/**
 * Check and tidy a title / text / link. Returns the cleaned draft, or the
 * problems (one per field) in plain English.
 */
export function validateAnnouncementDraft(input: {
  title?: unknown;
  body?: unknown;
  link?: unknown;
}): { ok: true; draft: AnnouncementDraft } | { ok: false; errors: Partial<Record<keyof AnnouncementDraft, string>> } {
  // The title is one line on a phone: newlines become spaces.
  const title = cleanText(input.title).replace(/\s*[\r\n]+\s*/gu, " ");
  const body = cleanText(input.body);
  const link = cleanText(input.link) || ANNOUNCEMENT_DEFAULT_LINK;
  const errors: Partial<Record<keyof AnnouncementDraft, string>> = {};

  if (!title) errors.title = "Write a title.";
  else if (charCount(title) > ANNOUNCEMENT_TITLE_MAX) errors.title = `Keep the title to ${ANNOUNCEMENT_TITLE_MAX} characters.`;
  if (!body) errors.body = "Write the announcement text.";
  else if (charCount(body) > ANNOUNCEMENT_BODY_MAX) errors.body = `Keep the text to ${ANNOUNCEMENT_BODY_MAX} characters.`;
  if (!isSafeInternalLink(link)) errors.link = 'The link must be a page on this site, starting with "/" (for example /dashboard).';

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, draft: { title, body, link } };
}

/**
 * Quick-pick links: real student pages on the website. `app` says what the
 * native app does with the link (origin-app src/api/notifications.ts
 * noticeTarget): "screen" opens an app screen, "browser" opens the website.
 */
export const ANNOUNCEMENT_QUICK_LINKS: readonly { label: string; path: string; app: "screen" | "browser" }[] = [
  { label: "Home", path: "/dashboard", app: "screen" },
  { label: "OGCode practice", path: "/ogcode", app: "screen" },
  { label: "Leaderboard", path: "/leaderboard", app: "screen" },
  { label: "Ask Ori", path: "/doubt-solver", app: "screen" },
  { label: "Study rooms", path: "/study-rooms", app: "screen" },
  { label: "Premium", path: "/premium", app: "screen" },
  { label: "Tests", path: "/tests", app: "browser" },
  { label: "DPP", path: "/dpp", app: "browser" },
];

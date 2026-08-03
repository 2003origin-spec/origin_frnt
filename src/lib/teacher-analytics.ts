/**
 * Teacher Analytics Deep-Dive — shared pure helpers.
 *
 * Plan: V1/allmd/TEACHER_ANALYTICS_DEEP_DIVE_PLAN_2026-08-03.md
 *
 * Deliberately dependency-free so BOTH the server stores (aggregation) and the
 * client chart components (presentation) import the same maths — a median or a
 * tone threshold must never disagree between an API payload and the cell that
 * renders it. Everything here is pure and unit-tested
 * (tests/workspaces/teacher-deep-analytics.test.ts).
 */

/** Performance band shared by every score-coloured surface in the epic. */
export type ScoreTone = "success" | "warning" | "danger" | "muted";

/**
 * Single source of truth for the score → tone mapping (plan §5).
 * `null`/`undefined`/NaN means "no underlying attempts", which renders as an
 * em-dash rather than a fabricated 0%.
 */
export function scoreTone(percentage: number | null | undefined): ScoreTone {
  if (percentage == null || !Number.isFinite(percentage)) return "muted";
  if (percentage >= 75) return "success";
  if (percentage >= 50) return "warning";
  return "danger";
}

/** Tailwind text colour per tone — token-based so light/dark both work. */
export const TONE_TEXT: Record<ScoreTone, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-destructive",
  muted: "text-muted-foreground",
};

/** Tailwind tinted-surface + border per tone (badges, heatmap cells). */
export const TONE_SURFACE: Record<ScoreTone, string> = {
  success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/10 border-destructive/20 text-destructive",
  muted: "bg-muted border-border text-muted-foreground",
};

/** Hex per tone, for recharts fills/strokes (SVG can't read Tailwind classes). */
export const TONE_HEX: Record<ScoreTone, string> = {
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "#94a3b8",
};

/** Chart series colours, matching the palette already used on this surface. */
export const CHART_COLORS = {
  primary: "#38bdf8",
  accent: "#06d6a0",
  violet: "#a78bfa",
  amber: "#f59e0b",
  emerald: "#10b981",
  destructive: "#ef4444",
  grid: "rgba(148,163,184,0.18)",
} as const;

/** Percentage formatted for display; `—` when there is nothing to show. */
export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Integer-ish display for counts; `—` when unknown (NOT 0). */
export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

/** Arithmetic mean, or null for an empty/all-invalid set (never NaN). */
export function average(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return null;
  return clean.reduce((sum, v) => sum + v, 0) / clean.length;
}

/**
 * Median. Even-sized sets average the two middle values (ledger #4); an empty
 * set is null, not 0.
 */
export function median(values: readonly number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 1 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

/** Labels for the ten 0–100 score buckets, in order. */
export const SCORE_BUCKET_LABELS = [
  "0-10%", "10-20%", "20-30%", "30-40%", "40-50%",
  "50-60%", "60-70%", "70-80%", "80-90%", "90-100%",
] as const;

export type ScoreBucket = { label: string; count: number; tone: ScoreTone };

/**
 * Histogram of scores into ten 10-point buckets. 100% lands in the last bucket
 * (not an 11th), and out-of-range/NaN values are dropped rather than clamped
 * into a bucket they don't belong in.
 */
export function scoreBuckets(scores: readonly number[]): ScoreBucket[] {
  const counts = new Array(10).fill(0) as number[];
  for (const score of scores) {
    if (!Number.isFinite(score) || score < 0 || score > 100) continue;
    counts[Math.min(9, Math.floor(score / 10))] += 1;
  }
  return counts.map((count, i) => ({
    label: SCORE_BUCKET_LABELS[i],
    count,
    // Tone by the bucket's UPPER edge, so "40-50%" reads as danger and
    // "70-80%" as success — matching how a teacher reads a mark band.
    tone: scoreTone((i + 1) * 10 - 0.01),
  }));
}

/** `1h 24m` / `24m` / `45s` from a second count. Negative/NaN → `—`. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

/**
 * `origin_users.total_study_time` is stored in MINUTES (see
 * gamification.updateUserStudyTime). Render it as hours for the teacher.
 */
export function formatStudyMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "—";
  const hours = minutes / 60;
  if (hours >= 10) return `${Math.round(hours)}h`;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}

/**
 * Escape a user-supplied search term for a SQL LIKE/ILIKE pattern (ledger #13).
 * Backslash first, then the wildcards — otherwise the escapes get re-escaped.
 * Pair with `ESCAPE '\'` in the query.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Normalise a raw search box value: trimmed, collapsed, length-capped. */
export function normalizeSearchTerm(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, 100);
}

export const STUDENT_SORT_KEYS = [
  "name",
  "meanPercentage",
  "attempts",
  "enrolledAt",
  "streak",
  "studyTime",
] as const;
export type StudentSortKey = (typeof STUDENT_SORT_KEYS)[number];
export type SortDirection = "asc" | "desc";

/** Whitelist a client-supplied sort key — never interpolate raw input into SQL. */
export function parseStudentSort(raw: string | null | undefined): StudentSortKey {
  return STUDENT_SORT_KEYS.includes(raw as StudentSortKey) ? (raw as StudentSortKey) : "name";
}

export function parseSortDirection(raw: string | null | undefined): SortDirection {
  return raw === "asc" || raw === "desc" ? raw : "asc";
}

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** Clamp pagination input so a hostile/typo'd query can't ask for the world. */
export function clampPageSize(raw: string | number | null | undefined): number {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsed)));
}

/** 1-based page number, clamped to >= 1. */
export function clampPage(raw: string | number | null | undefined): number {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

/**
 * Trailing simple moving average, used as the trend overlay on the score-trend
 * chart. Positions before a full window average what is available so the line
 * starts at the first point instead of floating.
 */
export function movingAverage(values: readonly number[], window = 3): (number | null)[] {
  if (window < 1) return values.map(() => null);
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter(Number.isFinite);
    return slice.length === 0 ? null : slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * India-only product: every day bucket rolls over at 00:00 IST, not UTC — the
 * same convention `src/server/gamification.ts` writes `app.daily_activities`
 * with. Analytics that reads those rows MUST bucket the same way or the last
 * column of a contribution grid drifts by a day (ledger #10).
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's IST calendar date as `YYYY-MM-DD`. */
export function istDateString(now: number = Date.now()): string {
  return new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The last `count` IST dates as `YYYY-MM-DD`, oldest first, ending today.
 * Used to build a dense series so days with no activity render as an explicit
 * gap rather than being silently dropped from the chart.
 */
export function istDateStrings(count: number, now: number = Date.now()): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  const today = new Date(now + IST_OFFSET_MS);
  return Array.from({ length: safeCount }, (_, i) => {
    const target = new Date(today);
    target.setUTCDate(today.getUTCDate() - (safeCount - 1 - i));
    return target.toISOString().slice(0, 10);
  });
}

/** Short weekday label (`Mon`) for a `YYYY-MM-DD` string, IST-safe. */
export function weekdayLabel(dateString: string): string {
  const parsed = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

/** Severity ordering for weak-topic intervention lists (worst first). */
export const SEVERITY_ORDER: Record<"high" | "medium" | "low", number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Truncate a chart axis label, keeping the full value for the tooltip. */
export function truncateLabel(label: string, max = 14): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

/** Initials for an avatar chip. Falls back to `?` for an empty name. */
export function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

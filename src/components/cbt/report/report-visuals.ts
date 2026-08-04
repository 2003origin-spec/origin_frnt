/**
 * Chart vocabulary for the CBT report card.
 *
 * Correct / wrong / skipped / review is a STATUS encoding, not series identity,
 * so it uses the fixed status palette rather than a categorical theme. That
 * palette's red↔green pair is not separable under deuteranopia (validated:
 * CVD ΔE 4.1), which is exactly why every place these colors appear also
 * carries an ICON and a LABEL — colour never carries the meaning on its own.
 * Red/green is kept because it is the convention a student already reads on an
 * answer sheet; the icon is the fix, not a different hue.
 *
 * Everything else on the report is a single-series chart, so it takes one hue
 * (the app's primary) for every bar rather than a value-ramp.
 */

export type CbtReportVerdictKey = "correct" | "wrong" | "skipped" | "review";

export type VerdictVisual = {
  key: CbtReportVerdictKey;
  label: string;
  /** Text glyph — survives PDF capture and forced-colors mode. */
  glyph: string;
  /** Status palette, light surface. */
  color: string;
  /** Same four steps, stepped for the dark surface. */
  colorDark: string;
  /** Tailwind chip classes used by the logs and the answer sheet. */
  chip: string;
};

export const VERDICTS: Record<CbtReportVerdictKey, VerdictVisual> = {
  correct: {
    key: "correct",
    label: "Correct",
    glyph: "✓",
    color: "#0ca30c",
    colorDark: "#0ca30c",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  wrong: {
    key: "wrong",
    label: "Wrong",
    glyph: "✕",
    color: "#d03b3b",
    colorDark: "#d03b3b",
    chip: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
  skipped: {
    key: "skipped",
    label: "Skipped",
    glyph: "–",
    color: "#8b8b85",
    colorDark: "#a3a39b",
    chip: "bg-muted text-muted-foreground",
  },
  review: {
    key: "review",
    label: "To review",
    glyph: "⋯",
    color: "#fab219",
    colorDark: "#fab219",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
};

export const VERDICT_ORDER: CbtReportVerdictKey[] = ["correct", "wrong", "skipped", "review"];

/** Formats seconds as the report shows them everywhere (`4m 12s`, `48s`). */
export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(rest).padStart(2, "0")}s`;
  return `${rest}s`;
}

/** Performance band for the hero line — encouraging, never a grade. */
export function scoreBand(percentage: number): { label: string; tone: string } {
  if (percentage >= 80) return { label: "Excellent work", tone: "text-emerald-600 dark:text-emerald-400" };
  if (percentage >= 60) return { label: "Strong attempt", tone: "text-primary" };
  if (percentage >= 40) return { label: "Good going", tone: "text-amber-600 dark:text-amber-400" };
  return { label: "Keep pushing", tone: "text-muted-foreground" };
}

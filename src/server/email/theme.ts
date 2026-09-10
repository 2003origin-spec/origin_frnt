/**
 * Origin email design tokens.
 *
 * Mirrors the Stitch "Responsive Notification Email System" project, but every
 * value lives here as a plain string because email HTML cannot use CSS custom
 * properties — each declaration is inlined onto the element that needs it.
 */

export const COLORS = {
  navy: "#05192d",
  navySoft: "#081b33",
  bodyBg: "#f0f7ff",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  mutedOnNavy: "#94a3b8",
  blue: "#2563eb",
  sky: "#38bdf8",
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  pill: "#f4f9ff",
  pillWarning: "#fffbeb",
  pillDanger: "#fef2f2",
  pillSuccess: "#ecfdf5",
} as const;

/**
 * 600px, not the 780px of the Stitch mockups. 600 is the widest a message can
 * be before Outlook's and Gmail's desktop reading panes force a horizontal
 * scroll; the design scales down cleanly.
 */
export const CONTENT_WIDTH = 600;

export const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** Tabular, evenly-spaced glyphs for OTP codes and reference ids. */
export const MONO_STACK =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono','Courier New',monospace";

export type AccentName = "blue" | "green" | "red" | "amber";

export const ACCENTS: Record<AccentName, string> = {
  blue: COLORS.blue,
  green: COLORS.green,
  red: COLORS.red,
  amber: COLORS.amber,
};

/** Mascot art in `public/email/`, keyed by the emotional register each mail needs. */
export type MascotName =
  | "happy"
  | "otp"
  | "failed"
  | "cbt"
  | "excited"
  | "thumbsup"
  | "proud"
  | "curious";

export const MASCOT_ALT: Record<MascotName, string> = {
  happy: "Ori, the Origin mascot, celebrating",
  otp: "Ori, the Origin mascot, holding a security code",
  failed: "Ori, the Origin mascot, looking puzzled",
  cbt: "Ori, the Origin mascot, at a laptop",
  excited: "Ori, the Origin mascot, cheering",
  thumbsup: "Ori, the Origin mascot, giving a thumbs up",
  proud: "Ori, the Origin mascot, looking proud",
  curious: "Ori, the Origin mascot, looking curious",
};

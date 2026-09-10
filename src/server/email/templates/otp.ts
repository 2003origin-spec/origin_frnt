/**
 * One-time-code emails: signup verification, password reset, and CBT teacher
 * sign-in. All three share the digit-tile layout and differ only in headline,
 * mascot, code lifetime and closing disclaimer.
 *
 * The plain-text bodies are kept byte-for-byte as they shipped before the
 * redesign — they are what lands in text-only clients and in spam-filter
 * heuristics, and there was no reason to churn them.
 */

import { infoStrip, otpCode, paragraph, renderEmail } from "../layout";
import { COLORS, FONT_STACK } from "../theme";

export type OtpEmailKind = "signup" | "reset" | "cbt";

export type RenderedEmail = { subject: string; text: string; html: string };

type OtpSpec = {
  subject: string;
  documentTitle: string;
  title: string;
  titleAccent: string;
  intro: string[];
  minutes: number;
  mascot: "otp" | "cbt";
  disclaimer: string;
  text: (code: string) => string;
  badge?: string;
};

const SPECS: Record<OtpEmailKind, OtpSpec> = {
  signup: {
    subject: "Verify your ORIGIN account",
    documentTitle: "Origin - Verify Your Email",
    title: "Verify Your",
    titleAccent: "Email",
    intro: [
      "Use the code below to verify your email address",
      "and continue your journey with Origin.",
    ],
    minutes: 5,
    mascot: "otp",
    disclaimer: "If you did not request this code, you can safely ignore this email.",
    text: (code) => `Your verification code is: ${code}. This code will expire in 5 minutes.`,
  },
  reset: {
    subject: "Reset your Origin password",
    documentTitle: "Origin - Reset Your Password",
    title: "Reset Your",
    titleAccent: "Password",
    intro: ["Use the code below to reset the password", "for your Origin account."],
    minutes: 15,
    mascot: "otp",
    disclaimer:
      "If you did not request a password reset, you can safely ignore this email — your password will not change.",
    text: (code) =>
      `Your Origin password reset code is ${code}. It expires in 15 minutes. If you did not request this, you can safely ignore this email.`,
  },
  cbt: {
    subject: "Your CBT sign-in code",
    documentTitle: "Origin - CBT Sign In",
    title: "CBT",
    titleAccent: "Sign In",
    intro: ["Use the code below to sign in", "to your CBT teacher account."],
    minutes: 5,
    mascot: "cbt",
    disclaimer: "If you did not request this code, please ignore this email.",
    text: (code) =>
      `Your CBT verification code is ${code}. It expires in 5 minutes. If you did not request this, ignore this email.`,
    badge: "TEACHER ACCOUNT",
  },
};

function validityLine(minutes: number): string {
  return `<p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLORS.muted};text-align:center;">This code is valid for <span style="color:${COLORS.blue};font-weight:700;">${minutes} minute${minutes === 1 ? "" : "s"}</span>.</p>`;
}

function copyHint(): string {
  return `<p style="margin:0 0 6px 0;font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${COLORS.muted};text-align:center;">Tap and hold the code to copy it.</p>`;
}

function badgeLine(text: string): string {
  return `<p style="margin:0;text-align:center;"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${COLORS.pill};color:${COLORS.blue};font-family:${FONT_STACK};font-size:11px;font-weight:700;letter-spacing:.8px;">${text}</span></p>`;
}

/** Render one of the three OTP emails. */
export function renderOtpEmail(kind: OtpEmailKind, code: string): RenderedEmail {
  const spec = SPECS[kind];
  const shareWarning =
    kind === "cbt"
      ? infoStrip("Never share this code with anyone.", "Origin staff will never ask for it.", "info", "cbt")
      : infoStrip("Never share your OTP with anyone.", "Origin will never ask for it.", "info", "otp");

  return {
    subject: spec.subject,
    text: spec.text(code),
    html: renderEmail({
      preheader: `${code} is your Origin code. It expires in ${spec.minutes} minutes.`,
      documentTitle: spec.documentTitle,
      mascot: spec.mascot,
      title: spec.title,
      titleAccent: spec.titleAccent,
      intro: spec.intro,
      blocks: [
        spec.badge ? badgeLine(spec.badge) : "",
        `<div style="padding:6px 0 12px 0;">${otpCode(code)}</div>${copyHint()}${validityLine(spec.minutes)}`,
        shareWarning,
        paragraph(spec.disclaimer, { muted: true, size: 13, align: "center" }),
      ],
      footerNote: "This is an automated security email. Please do not reply.",
    }),
  };
}

/**
 * Contest reminder emails.
 *
 * Subject and plain-text body still come from `reminderCopy()` in
 * `src/lib/contest/reminders.ts` so the in-app notification, push, WhatsApp and
 * email all keep saying the same thing. This module only adds the HTML part,
 * which those reminders previously went out without.
 *
 * These are transactional (the student registered for the contest), so no
 * unsubscribe link is added — but the footer says why they are receiving it.
 */

import { infoStrip, renderEmail } from "../layout";
import { type ReminderKind, reminderCopy } from "@/lib/contest/reminders";
import type { RenderedEmail } from "./otp";
import type { AccentName, MascotName } from "../theme";

type ReminderStyle = {
  accent: AccentName;
  mascot: MascotName;
  ctaLabel: string;
  strip: [bold: string, detail: string];
};

const STYLES: Record<ReminderKind, ReminderStyle> = {
  confirmation: {
    accent: "green",
    mascot: "thumbsup",
    ctaLabel: "View contest",
    strip: ["You're on the list.", "We'll remind you 24 hours, 1 hour and 10 minutes before it starts."],
  },
  t_24h: {
    accent: "blue",
    mascot: "curious",
    ctaLabel: "View contest",
    strip: ["Get a practice run in today.", "Warming up beats cramming right before the timer."],
  },
  t_1h: {
    accent: "amber",
    mascot: "excited",
    ctaLabel: "Enter contest",
    strip: ["Find a quiet spot now.", "Keep your device charged and your connection steady."],
  },
  t_10m: {
    accent: "amber",
    mascot: "excited",
    ctaLabel: "Enter contest",
    strip: ["Be in before the timer starts.", "Late entries lose attempt time."],
  },
  results: {
    accent: "amber",
    mascot: "proud",
    ctaLabel: "View results",
    strip: ["Review your mistakes while they're fresh.", "Solutions and explanations are unlocked now."],
  },
};

/**
 * Build the email for one reminder kind. `href` is the app-relative contest
 * route; `renderEmail` resolves it against the public site origin.
 */
export function renderContestReminderEmail(
  kind: ReminderKind,
  contestName: string,
  href: string,
): RenderedEmail {
  const copy = reminderCopy(kind, contestName);
  const style = STYLES[kind];
  return {
    subject: copy.title,
    text: `${copy.body}\n\nOpen Origin: ${href}`,
    html: renderEmail({
      preheader: copy.body,
      documentTitle: `Origin - ${copy.title}`,
      mascot: style.mascot,
      title: copy.title,
      accent: style.accent,
      intro: [copy.body],
      blocks: [infoStrip(style.strip[0], style.strip[1], "info", style.mascot)],
      cta: { label: style.ctaLabel, href, accent: style.accent },
      footerNote: "You're receiving this because you registered for this contest.",
    }),
  };
}

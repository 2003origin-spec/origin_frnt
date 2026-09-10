/**
 * Email HTML layout primitives.
 *
 * These render *email* HTML, which is a much narrower language than web HTML:
 *
 *   - Layout is nested `<table role="presentation">`, never flexbox or grid.
 *     Outlook on Windows renders through Word's engine and ignores both.
 *   - Every declaration is inlined on the element. Gmail strips most of what a
 *     `<style>` block declares, so the only thing in the head `<style>` is the
 *     mobile media query (which Gmail does honour) plus a couple of client
 *     resets — the design must already be correct with that block discarded.
 *   - Illustrations are absolute-URL PNGs from `public/email/`. Inline `<svg>`
 *     is stripped outright by Gmail and Outlook, so the Stitch mockups' vector
 *     art is pre-rasterised instead.
 *   - No `<script>`, no web fonts, no `backdrop-filter`. Gradients and shadows
 *     degrade to flat fills rather than being relied on.
 *
 * Everything interpolated into HTML goes through `esc()`. Callers pass plain
 * text; the few places that need markup use the block builders below.
 */

import { ACCENTS, COLORS, CONTENT_WIDTH, FONT_STACK, MASCOT_ALT, MONO_STACK, type AccentName, type MascotName } from "./theme";
import { absoluteHref, assetUrl, footerLinks, siteUrl, socialLinks, supportHref } from "./assets";

/** HTML-escape untrusted text. Applied to every interpolated value. */
export function esc(value: unknown): string {
  return (typeof value === "string" ? value : value == null ? "" : String(value))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const TABLE_RESET = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

/**
 * Outlook on Windows renders through Word, which ignores the CSS `background`
 * shorthand on tables and cells. Every tinted surface therefore carries a
 * `bgcolor` attribute *as well as* the inline style — drop one and the cards
 * and strips lose their fill in Outlook while looking fine everywhere else.
 */

export type PillTone = "success" | "danger" | "info" | "warning";

const PILL_STYLES: Record<PillTone, { bg: string; fg: string }> = {
  success: { bg: COLORS.pillSuccess, fg: "#047857" },
  danger: { bg: COLORS.pillDanger, fg: "#b91c1c" },
  info: { bg: COLORS.pill, fg: COLORS.blue },
  warning: { bg: COLORS.pillWarning, fg: "#b45309" },
};

export type DetailRow = {
  label: string;
  value: string;
  /** Render the value as a coloured status pill instead of plain text. */
  pill?: PillTone;
};

export type EmailCta = {
  label: string;
  href: string;
  accent?: AccentName;
};

/** A coloured status pill, e.g. Success / Failed / Processed. */
function pill(text: string, tone: PillTone): string {
  const { bg, fg } = PILL_STYLES[tone];
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};mso-padding-alt:4px 12px;color:${fg};font-family:${FONT_STACK};font-size:13px;font-weight:600;line-height:1.2;">${esc(text)}</span>`;
}

/**
 * A bordered white card of label/value rows — the "Payment Details" block.
 * Rows stack label-above-value on narrow screens via the `.dt-stack` class.
 */
export function detailsCard(heading: string, rows: DetailRow[]): string {
  const body = rows
    .filter((r) => r.value.trim() !== "")
    .map((r, i) => {
      const border = i === 0 ? "" : `border-top:1px solid ${COLORS.border};`;
      const value = r.pill ? pill(r.value, r.pill) : esc(r.value);
      return `<tr>
<td class="dt-stack" style="${border}padding:12px 0 12px 0;font-family:${FONT_STACK};font-size:14px;color:${COLORS.muted};line-height:1.4;" align="left">${esc(r.label)}</td>
<td class="dt-stack dt-value" style="${border}padding:12px 0 12px 0;font-family:${FONT_STACK};font-size:14px;font-weight:600;color:${COLORS.text};line-height:1.4;" align="right">${value}</td>
</tr>`;
    })
    .join("");
  return `<table ${TABLE_RESET} width="100%" bgcolor="${COLORS.card}" style="width:100%;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;">
<tr><td style="padding:20px 22px 4px 22px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:${COLORS.text};">${esc(heading)}</td></tr>
<tr><td style="padding:0 22px 14px 22px;"><table ${TABLE_RESET} width="100%" style="width:100%;">${body}</table></td></tr>
</table>`;
}

/**
 * A tinted strip with the mascot on the left and a bold line over a lighter
 * one — the "Don't worry, it happens!" and "You're all set!" blocks.
 */
export function infoStrip(bold: string, detail: string, tone: PillTone = "info", mascot: MascotName = "curious"): string {
  const { bg } = PILL_STYLES[tone];
  return `<table ${TABLE_RESET} width="100%" bgcolor="${bg}" style="width:100%;background:${bg};border-radius:14px;">
<tr>
<td width="72" style="padding:14px 0 14px 16px;" valign="middle"><img src="${assetUrl(`mascot-${mascot}.png`)}" width="56" height="56" alt="" style="display:block;border:0;outline:none;text-decoration:none;width:56px;height:auto;"></td>
<td style="padding:14px 18px 14px 12px;font-family:${FONT_STACK};font-size:14px;line-height:1.5;color:${COLORS.text};" valign="middle">
<span style="font-weight:700;">${esc(bold)}</span>${detail ? `<br><span style="color:${COLORS.muted};">${esc(detail)}</span>` : ""}
</td>
</tr>
</table>`;
}

/**
 * The OTP code block.
 *
 * Deliberately ONE text node rather than a tile per digit. Email clients strip
 * JavaScript, so a real "Copy" button is impossible — what makes a code
 * copyable is that it is a single contiguous token:
 *
 *   - Long-pressing it on mobile selects the whole code, not one digit.
 *   - Gmail and Apple Mail only offer their built-in "Copy code" / autofill
 *     affordance when they can detect a code; six separate <td>s read as
 *     "4 7 2 9 1 6" and defeat that detection.
 *   - `user-select:all` makes a single tap select the entire code where the
 *     client keeps the declaration.
 *
 * Letter-spacing is visual only, so the copied string is still "472916".
 * The right padding compensates for the trailing letter-space so the digits
 * stay optically centred.
 */
export function otpCode(code: string): string {
  const value = code.trim();
  return `<table ${TABLE_RESET} align="center" style="margin:0 auto;">
<tr><td align="center" bgcolor="${COLORS.pill}" style="background:${COLORS.pill};border:1px solid ${COLORS.border};border-radius:14px;padding:16px 22px 16px 32px;">
<span style="display:inline-block;font-family:${MONO_STACK};font-size:34px;font-weight:700;line-height:1.1;color:${COLORS.blue};letter-spacing:10px;user-select:all;-webkit-user-select:all;-moz-user-select:all;-ms-user-select:all;">${esc(value)}</span>
</td></tr>
</table>`;
}

/** A row of up to three metric tiles that stack on mobile. */
export function statTiles(items: { label: string; value: string }[]): string {
  const cells = items
    .map(
      (it) =>
        `<td class="stack" width="33%" valign="top" style="padding:0 5px;">
<table ${TABLE_RESET} width="100%" bgcolor="${COLORS.card}" style="width:100%;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;">
<tr><td align="center" style="padding:16px 8px;font-family:${FONT_STACK};">
<div style="font-size:20px;font-weight:700;color:${COLORS.text};line-height:1.2;">${esc(it.value)}</div>
<div style="font-size:12px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:.4px;padding-top:4px;">${esc(it.label)}</div>
</td></tr></table></td>`,
    )
    .join("");
  return `<table ${TABLE_RESET} width="100%" style="width:100%;"><tr>${cells}</tr></table>`;
}

/** A plain body paragraph. */
export function paragraph(text: string, opts: { muted?: boolean; size?: number; align?: string } = {}): string {
  const color = opts.muted ? COLORS.muted : COLORS.text;
  return `<p style="margin:0 0 12px 0;font-family:${FONT_STACK};font-size:${opts.size ?? 15}px;line-height:1.6;color:${color};text-align:${opts.align ?? "left"};">${esc(text)}</p>`;
}

/** The primary call-to-action button, full width of the card. */
function ctaButton(cta: EmailCta): string {
  const bg = ACCENTS[cta.accent ?? "blue"];
  const href = absoluteHref(cta.href);
  return `<table ${TABLE_RESET} width="100%" style="width:100%;">
<tr><td align="center" bgcolor="${bg}" style="border-radius:12px;">
<a href="${esc(href)}" style="display:block;padding:15px 24px;font-family:${FONT_STACK};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(cta.label)} &rarr;</a>
</td></tr></table>`;
}

function supportBlock(): string {
  return `<p style="margin:0;font-family:${FONT_STACK};font-size:14px;line-height:1.6;color:${COLORS.muted};text-align:center;">
Need help? <a href="${esc(supportHref())}" style="color:${COLORS.blue};text-decoration:none;font-weight:600;">Contact our support team</a><br>&mdash; we&#39;re here for you.
</p>`;
}

function header(): string {
  return `<tr><td align="center" bgcolor="${COLORS.navy}" style="background:${COLORS.navy};padding:26px 24px;border-radius:0;">
<a href="${esc(siteUrl())}" style="text-decoration:none;"><img src="${assetUrl("logo-wordmark.png")}" width="180" alt="Origin" style="display:block;border:0;outline:none;text-decoration:none;width:180px;height:auto;"></a>
</td></tr>`;
}

function footer(note: string, unsubscribeHref?: string): string {
  const utility = footerLinks()
    .map(
      (l) =>
        `<a href="${esc(l.href)}" style="color:${COLORS.mutedOnNavy};text-decoration:none;font-family:${FONT_STACK};font-size:12px;padding:0 7px;">${esc(l.label)}</a>`,
    )
    .join(`<span style="color:#334155;">&middot;</span>`);
  const social = socialLinks()
    .map(
      (s) =>
        `<a href="${esc(s.href)}" style="color:${COLORS.sky};text-decoration:none;font-family:${FONT_STACK};font-size:13px;font-weight:600;padding:0 8px;">${esc(s.label)}</a>`,
    )
    .join(`<span style="color:#334155;">&middot;</span>`);
  const unsubscribe = unsubscribeHref
    ? `<p style="margin:10px 0 0 0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLORS.mutedOnNavy};text-align:center;"><a href="${esc(absoluteHref(unsubscribeHref))}" style="color:${COLORS.mutedOnNavy};text-decoration:underline;">Unsubscribe from these emails</a></p>`
    : "";
  return `<tr><td align="center" bgcolor="${COLORS.navy}" style="background:${COLORS.navy};padding:28px 24px 30px 24px;">
<img src="${assetUrl("logo-wordmark.png")}" width="150" alt="Origin" style="display:block;border:0;outline:none;text-decoration:none;width:150px;height:auto;margin:0 auto 14px auto;">
<div style="padding:0 0 10px 0;">${social}</div>
<div style="padding:0 0 14px 0;">${utility}</div>
<p style="margin:0;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${COLORS.mutedOnNavy};text-align:center;">
&copy; ${new Date().getFullYear()} Origin. All rights reserved.${note ? `<br>${esc(note)}` : ""}
</p>${unsubscribe}
</td></tr>`;
}

export type EmailShellInput = {
  /** Inbox preview text. Shown next to the subject; never rendered in the body. */
  preheader: string;
  /** Document title — some clients use it for "view in browser". */
  documentTitle: string;
  mascot?: MascotName;
  /** Headline, split so the tail can carry the accent colour. */
  title: string;
  titleAccent?: string;
  accent?: AccentName;
  /** Subtitle lines under the headline, centred. */
  intro?: string[];
  /** Pre-rendered blocks (detailsCard / infoStrip / otpCode / statTiles / paragraph). */
  blocks?: string[];
  cta?: EmailCta;
  /** Show the "Need help?" support line above the footer. Defaults to true. */
  support?: boolean;
  /** Closing line inside the dark footer, under the copyright. */
  footerNote?: string;
  /** Adds an unsubscribe link. Required for anything non-transactional. */
  unsubscribeHref?: string;
};

/** Render a complete email document. */
export function renderEmail(input: EmailShellInput): string {
  const accent = ACCENTS[input.accent ?? "blue"];
  const mascotImg = input.mascot
    ? `<tr><td align="center" style="padding:8px 24px 4px 24px;"><img src="${assetUrl(`mascot-${input.mascot}.png`)}" width="132" alt="${esc(MASCOT_ALT[input.mascot])}" style="display:block;border:0;outline:none;text-decoration:none;width:132px;height:auto;margin:0 auto;"></td></tr>`
    : "";
  const intro = (input.intro ?? []).length
    ? `<tr><td align="center" style="padding:0 28px 6px 28px;"><p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${COLORS.muted};text-align:center;">${(input.intro ?? []).map((l) => esc(l)).join("<br>")}</p></td></tr>`
    : "";
  const blocks = (input.blocks ?? [])
    .filter(Boolean)
    .map((b) => `<tr><td style="padding:10px 24px 0 24px;">${b}</td></tr>`)
    .join("");
  const cta = input.cta
    ? `<tr><td style="padding:22px 24px 4px 24px;">${ctaButton(input.cta)}</td></tr>`
    : "";
  const support = input.support === false ? "" : `<tr><td style="padding:20px 28px 4px 28px;">${supportBlock()}</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(input.documentTitle)}</title>
<style>
  /* Gmail honours a head <style>; Outlook ignores it. Nothing here is load-bearing. */
  body { margin:0 !important; padding:0 !important; width:100% !important; }
  img { -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
  @media only screen and (max-width:600px) {
    .wrap { width:100% !important; }
    .pad { padding-left:18px !important; padding-right:18px !important; }
    .stack { display:block !important; width:100% !important; padding:0 0 10px 0 !important; }
    .dt-stack { display:block !important; width:100% !important; text-align:left !important; padding-bottom:0 !important; }
    .dt-value { padding-top:2px !important; padding-bottom:12px !important; }
    .h1 { font-size:26px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.bodyBg};">
<div style="display:none;font-size:1px;color:${COLORS.bodyBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(input.preheader)}</div>
<table ${TABLE_RESET} width="100%" bgcolor="${COLORS.bodyBg}" style="width:100%;background:${COLORS.bodyBg};">
<tr><td align="center" style="padding:24px 12px;">
<table ${TABLE_RESET} class="wrap" width="${CONTENT_WIDTH}" bgcolor="${COLORS.card}" style="width:${CONTENT_WIDTH}px;max-width:${CONTENT_WIDTH}px;background:${COLORS.card};border-radius:18px;overflow:hidden;">
${header()}
${mascotImg}
<tr><td class="pad" align="center" style="padding:14px 28px 8px 28px;">
<h1 class="h1" style="margin:0;font-family:${FONT_STACK};font-size:30px;line-height:1.25;font-weight:700;color:${COLORS.text};text-align:center;">${esc(input.title)}${input.titleAccent ? ` <span style="color:${accent};">${esc(input.titleAccent)}</span>` : ""}</h1>
</td></tr>
${intro}
${blocks}
${cta}
${support}
<tr><td style="padding:22px 0 0 0;"></td></tr>
${footer(input.footerNote ?? "", input.unsubscribeHref)}
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Student messaging — pure UI rules for the website (no React, no fetch), so
 * they can be unit tested on their own (tests/unit/messaging-ui.test.ts).
 *
 * The unit maths mirrors the server (src/server/messaging/rules.ts): a message
 * costs max(1, ceil(words / 10)) units, words = whitespace-separated tokens,
 * at most 500 characters (code points). The server stays the authority; these
 * only drive the hints shown while typing.
 */

import { formatISTDayDMY, formatISTTime } from '@/lib/format-time';
import { istEpochDayFromMs } from '@/lib/ist-day';

import type { ChatMessage, Conversation, MessagingUsage } from './types';

export const MESSAGE_MAX_CHARS = 500;
export const WORDS_PER_UNIT = 10;
export const REPORT_NOTE_MAX_CHARS = 1000;

// ── Units ───────────────────────────────────────────────────────────────────

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/** Units a message costs: max(1, ceil(words / 10)). */
export function messageUnits(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / WORDS_PER_UNIT));
}

/** Characters as the server counts them (code points, after trimming). */
export function messageLength(text: string): number {
  return [...text.trim()].length;
}

/** "1 message" / "3 messages". */
export function pluralMessages(n: number): string {
  return `${n} ${n === 1 ? 'message' : 'messages'}`;
}

// ── Daily cap ───────────────────────────────────────────────────────────────

export function unitsLeft(usage: MessagingUsage): number {
  return Math.max(0, usage.limit - usage.used);
}

export function isCapReached(usage: MessagingUsage): boolean {
  return unitsLeft(usage) <= 0;
}

/** "7 of 10 messages left today". */
export function usageLine(usage: MessagingUsage): string {
  return `${unitsLeft(usage)} of ${usage.limit} ${usage.limit === 1 ? 'message' : 'messages'} left today`;
}

/** When the cap resets, in IST: "Resets at 12:00 am IST on 02/11/2026". */
export function resetText(resetsAt: string): string {
  const time = formatISTTime(resetsAt);
  const day = formatISTDayDMY(resetsAt);
  if (time === '—' || day === '—') return 'Resets at midnight IST';
  return `Resets at ${time.toLowerCase()} IST on ${day}`;
}

export type ComposerState = {
  units: number;
  length: number;
  empty: boolean;
  tooLong: boolean;
  /** The message fits in what is left today. */
  fits: boolean;
  canSend: boolean;
  /** The live line under the box: "This costs 2 messages · 7 of 10 left today". */
  hint: string;
  /** True when the hint is a problem (too long / does not fit). */
  warn: boolean;
};

export function composerState(text: string, usage: MessagingUsage | null): ComposerState {
  const length = messageLength(text);
  const empty = length === 0;
  const tooLong = length > MESSAGE_MAX_CHARS;
  const units = messageUnits(text);
  const left = usage ? unitsLeft(usage) : Infinity;
  const fits = units <= left;
  let hint: string;
  let warn = false;
  if (tooLong) {
    hint = `Keep a message under ${MESSAGE_MAX_CHARS} characters.`;
    warn = true;
  } else if (usage && left <= 0) {
    hint = `You've used today's ${pluralMessages(usage.limit)}.`;
    warn = true;
  } else if (!empty && !fits) {
    hint = `This needs ${pluralMessages(units)}, you have ${left} left today. Shorten it.`;
    warn = true;
  } else if (empty) {
    hint = usage ? usageLine(usage) : 'Every 10 words cost 1 message.';
  } else {
    hint = `This costs ${pluralMessages(units)}` + (usage ? ` · ${left} left today` : '');
  }
  return { units, length, empty, tooLong, fits, canSend: !empty && !tooLong && fits, hint, warn };
}

// ── Thread banner (who may do what) ─────────────────────────────────────────

export type ThreadBannerKind =
  | 'none'
  | 'request_received'
  | 'request_sent'
  | 'declined_by_them'
  | 'declined_by_me'
  | 'blocked_by_me'
  | 'blocked';

export type ThreadBanner = {
  kind: ThreadBannerKind;
  /** Student-readable line; empty for `none`. */
  text: string;
  /** Whether the composer is shown. */
  canCompose: boolean;
  /** Show the Accept / Decline / Block bar. */
  showRequestActions: boolean;
  /** Show Accept only (a request I declined earlier). */
  showAcceptOnly: boolean;
  showUnblock: boolean;
};

export function threadBanner(c: Pick<Conversation, 'status' | 'requestedByMe' | 'blockedByMe' | 'other'>): ThreadBanner {
  const name = firstName(c.other.name);
  const base: ThreadBanner = {
    kind: 'none',
    text: '',
    canCompose: false,
    showRequestActions: false,
    showAcceptOnly: false,
    showUnblock: false,
  };
  switch (c.status) {
    case 'accepted':
      return { ...base, canCompose: true };
    case 'pending':
      return c.requestedByMe
        ? { ...base, kind: 'request_sent', text: `Request sent. You can send more once ${name} accepts.` }
        : {
            ...base,
            kind: 'request_received',
            text: `${name} wants to message you. Accept to reply, decline, or block.`,
            showRequestActions: true,
          };
    case 'declined':
      return c.requestedByMe
        ? { ...base, kind: 'declined_by_them', text: 'Request not accepted. You can’t send more messages here.' }
        : { ...base, kind: 'declined_by_me', text: 'You declined this request. Accept it to reply.', showAcceptOnly: true };
    case 'blocked':
      return c.blockedByMe
        ? { ...base, kind: 'blocked_by_me', text: `You blocked ${name}. Neither of you can send messages.`, showUnblock: true }
        : { ...base, kind: 'blocked', text: 'You can’t message this student.' };
    default:
      return base;
  }
}

// ── Lists, times, badge ─────────────────────────────────────────────────────

export function firstName(name: string): string {
  const first = name.trim().split(/\s+/u)[0];
  return first || 'This student';
}

/** Inbox row time: "4:30 pm" today, "Yesterday", else "29/10/2026" (all IST). */
export function rowTime(iso: string, nowMs: number = Date.now()): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = istEpochDayFromMs(nowMs) - istEpochDayFromMs(ms);
  if (diff <= 0) return formatISTTime(ms).toLowerCase();
  if (diff === 1) return 'Yesterday';
  return formatISTDayDMY(ms);
}

/** Day divider in a thread: "Today", "Yesterday", or "29/10/2026" (IST). */
export function dayLabel(iso: string, nowMs: number = Date.now()): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '';
  const diff = istEpochDayFromMs(nowMs) - istEpochDayFromMs(ms);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatISTDayDMY(ms);
}

/** True when two instants fall on different IST days (start a new divider). */
export function isNewDay(prevIso: string | null, iso: string): boolean {
  if (!prevIso) return true;
  return istEpochDayFromMs(new Date(prevIso).getTime()) !== istEpochDayFromMs(new Date(iso).getTime());
}

/** Merge pages of messages: dedupe by id, oldest first (ties keep id order). */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => {
    const d = new Date(a.at).getTime() - new Date(b.at).getTime();
    return d !== 0 ? d : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Nav badge: unread messages across the inbox plus waiting requests. */
export function badgeCount(conversations: Pick<Conversation, 'unread'>[], requestCount: number): number {
  const unread = conversations.reduce((sum, c) => sum + (c.unread > 0 ? c.unread : 0), 0);
  return unread + Math.max(0, requestCount);
}

export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** Inbox row preview: "You: hi" for my own last message, a request hint otherwise. */
export function previewText(c: Pick<Conversation, 'lastMessage' | 'status' | 'requestedByMe'>): string {
  if (c.status === 'pending' && c.requestedByMe && !c.lastMessage) return 'Request sent';
  if (!c.lastMessage) return c.status === 'pending' ? 'Message request' : 'No messages yet';
  const text = c.lastMessage.text.replace(/\s+/gu, ' ').trim();
  return c.lastMessage.fromMe ? `You: ${text}` : text;
}

/** A short status chip for an inbox row, or null. */
export function rowStatus(c: Pick<Conversation, 'status' | 'requestedByMe'>): string | null {
  if (c.status === 'pending') return c.requestedByMe ? 'Pending' : 'Request';
  if (c.status === 'declined') return c.requestedByMe ? 'Not accepted' : 'Declined';
  if (c.status === 'blocked') return 'Blocked';
  return null;
}

/** `?box=requests` → requests, anything else → inbox. */
export function parseBox(value: string | string[] | null | undefined): 'inbox' | 'requests' {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'requests' ? 'requests' : 'inbox';
}

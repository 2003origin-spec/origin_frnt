/**
 * Student messaging — the website's pure UI rules (src/features/messaging/messaging-ui.ts):
 * units, the live composer hint, cap text, the thread banner state machine, inbox
 * row helpers and the nav badge. No DOM, no network.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  badgeCount,
  badgeLabel,
  composerState,
  countWords,
  dayLabel,
  firstName,
  isCapReached,
  isNewDay,
  MESSAGE_MAX_CHARS,
  mergeMessages,
  messageLength,
  messageUnits,
  parseBox,
  pluralMessages,
  previewText,
  resetText,
  rowStatus,
  rowTime,
  threadBanner,
  unitsLeft,
  usageLine,
} from '@/features/messaging/messaging-ui';
import type { ChatMessage, Conversation, MessagingUsage } from '@/features/messaging/types';

const usage = (used: number, limit = 10, premium = false): MessagingUsage => ({
  used,
  limit,
  premium,
  resetsAt: '2026-11-01T18:30:00.000Z', // 02/11/2026 00:00 IST
});

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

const other = { id: 'u2', username: 'riya', name: 'Riya Sharma', avatar: null };

// ── Units ───────────────────────────────────────────────────────────────────

test('units = max(1, ceil(words / 10)), same as the server', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('   '), 0);
  assert.equal(countWords(' hi\n there\tyou '), 3);
  assert.equal(messageUnits(''), 1);
  assert.equal(messageUnits('hi'), 1);
  assert.equal(messageUnits(words(10)), 1);
  assert.equal(messageUnits(words(11)), 2);
  assert.equal(messageUnits(words(20)), 2);
  assert.equal(messageUnits(words(21)), 3);
});

test('length counts code points after trimming (an emoji is one character)', () => {
  assert.equal(messageLength('  ab  '), 2);
  assert.equal(messageLength('😀😀'), 2);
});

test('pluralMessages', () => {
  assert.equal(pluralMessages(1), '1 message');
  assert.equal(pluralMessages(3), '3 messages');
});

// ── Cap text ────────────────────────────────────────────────────────────────

test('usage line and cap', () => {
  assert.equal(usageLine(usage(3)), '7 of 10 messages left today');
  assert.equal(usageLine(usage(12)), '0 of 10 messages left today');
  assert.equal(unitsLeft(usage(12)), 0);
  assert.equal(isCapReached(usage(9)), false);
  assert.equal(isCapReached(usage(10)), true);
});

test('reset text is in IST, dd/mm/yyyy', () => {
  const text = resetText('2026-11-01T18:30:00.000Z');
  assert.match(text, /^Resets at 12:00 am IST on 02\/11\/2026$/);
  assert.equal(resetText('not a date'), 'Resets at midnight IST');
});

// ── Composer ────────────────────────────────────────────────────────────────

test('composer: empty shows the usage line and cannot send', () => {
  const s = composerState('   ', usage(3));
  assert.equal(s.empty, true);
  assert.equal(s.canSend, false);
  assert.equal(s.hint, '7 of 10 messages left today');
  assert.equal(s.warn, false);
});

test('composer: live cost hint', () => {
  assert.equal(composerState('hello there', usage(3)).hint, 'This costs 1 message · 7 left today');
  const s = composerState(words(25), usage(3));
  assert.equal(s.units, 3);
  assert.equal(s.hint, 'This costs 3 messages · 7 left today');
  assert.equal(s.canSend, true);
});

test('composer: a message bigger than what is left cannot be sent', () => {
  const s = composerState(words(25), usage(8));
  assert.equal(s.fits, false);
  assert.equal(s.canSend, false);
  assert.equal(s.warn, true);
  assert.match(s.hint, /needs 3 messages, you have 2 left/);
});

test('composer: over 500 characters is refused', () => {
  const s = composerState('a'.repeat(MESSAGE_MAX_CHARS + 1), usage(0));
  assert.equal(s.tooLong, true);
  assert.equal(s.canSend, false);
  assert.equal(s.warn, true);
  assert.equal(composerState('a'.repeat(MESSAGE_MAX_CHARS), usage(0)).canSend, true);
});

test('composer: cap reached', () => {
  const s = composerState('hi', usage(10));
  assert.equal(s.canSend, false);
  assert.equal(s.hint, "You've used today's 10 messages.");
});

test('composer: without usage yet it still shows the cost', () => {
  const s = composerState('hi', null);
  assert.equal(s.canSend, true);
  assert.equal(s.hint, 'This costs 1 message');
});

// ── Thread banner ───────────────────────────────────────────────────────────

test('banner: accepted → compose, no banner', () => {
  const b = threadBanner({ status: 'accepted', requestedByMe: true, other });
  assert.equal(b.kind, 'none');
  assert.equal(b.canCompose, true);
  assert.equal(b.text, '');
});

test('banner: pending I sent → wait, no composer', () => {
  const b = threadBanner({ status: 'pending', requestedByMe: true, other });
  assert.equal(b.kind, 'request_sent');
  assert.equal(b.canCompose, false);
  assert.match(b.text, /once Riya accepts/);
});

test('banner: pending sent to me → Accept / Decline / Block bar', () => {
  const b = threadBanner({ status: 'pending', requestedByMe: false, other });
  assert.equal(b.kind, 'request_received');
  assert.equal(b.showRequestActions, true);
  assert.equal(b.canCompose, false);
});

test('banner: declined', () => {
  const mine = threadBanner({ status: 'declined', requestedByMe: true, other });
  assert.equal(mine.kind, 'declined_by_them');
  assert.match(mine.text, /Request not accepted/);
  assert.equal(mine.canCompose, false);
  assert.equal(mine.showAcceptOnly, false);
  const theirs = threadBanner({ status: 'declined', requestedByMe: false, other });
  assert.equal(theirs.kind, 'declined_by_me');
  assert.equal(theirs.showAcceptOnly, true);
});

test('banner: blocked — Unblock only for the blocker', () => {
  const byMe = threadBanner({ status: 'blocked', requestedByMe: false, blockedByMe: true, other });
  assert.equal(byMe.kind, 'blocked_by_me');
  assert.equal(byMe.showUnblock, true);
  assert.equal(byMe.canCompose, false);
  const byThem = threadBanner({ status: 'blocked', requestedByMe: true, blockedByMe: false, other });
  assert.equal(byThem.kind, 'blocked');
  assert.equal(byThem.showUnblock, false);
  // An older server without blockedByMe never offers Unblock.
  assert.equal(threadBanner({ status: 'blocked', requestedByMe: true, other }).showUnblock, false);
});

test('firstName', () => {
  assert.equal(firstName('Riya Sharma'), 'Riya');
  assert.equal(firstName('  '), 'This student');
});

// ── Times ───────────────────────────────────────────────────────────────────

test('row time and day label use IST days', () => {
  const now = Date.parse('2026-11-01T12:00:00.000Z'); // 01/11/2026 5:30 pm IST
  assert.equal(rowTime('2026-11-01T04:00:00.000Z', now), '09:30 am');
  // 31/10 19:00 UTC is already 01/11 00:30 IST → today.
  assert.equal(dayLabel('2026-10-31T19:00:00.000Z', now), 'Today');
  assert.equal(rowTime('2026-10-31T10:00:00.000Z', now), 'Yesterday');
  assert.equal(dayLabel('2026-10-31T10:00:00.000Z', now), 'Yesterday');
  assert.equal(rowTime('2026-10-20T10:00:00.000Z', now), '20/10/2026');
  assert.equal(rowTime('nope', now), '');
});

test('isNewDay splits on IST midnight', () => {
  assert.equal(isNewDay(null, '2026-11-01T10:00:00.000Z'), true);
  assert.equal(isNewDay('2026-10-31T18:00:00.000Z', '2026-10-31T18:20:00.000Z'), false); // 23:30 → 23:50 IST
  assert.equal(isNewDay('2026-10-31T18:20:00.000Z', '2026-10-31T18:40:00.000Z'), true); // 23:50 → 00:10 IST
});

// ── Lists ───────────────────────────────────────────────────────────────────

const msg = (id: string, at: string, fromMe = false): ChatMessage => ({ id, text: id, fromMe, at, units: 1 });

test('mergeMessages dedupes and keeps oldest first', () => {
  const a = [msg('m1', '2026-11-01T10:00:00Z'), msg('m2', '2026-11-01T10:01:00Z')];
  const b = [msg('m2', '2026-11-01T10:01:00Z'), msg('m3', '2026-11-01T10:02:00Z')];
  assert.deepEqual(mergeMessages(a, b).map((m) => m.id), ['m1', 'm2', 'm3']);
  // An older page prepended.
  const older = [msg('m0', '2026-11-01T09:00:00Z')];
  assert.deepEqual(mergeMessages(older, a).map((m) => m.id), ['m0', 'm1', 'm2']);
});

test('badge = unread across the inbox + requests', () => {
  assert.equal(badgeCount([{ unread: 2 }, { unread: 0 }, { unread: 3 }], 1), 6);
  assert.equal(badgeCount([], 0), 0);
  assert.equal(badgeCount([{ unread: -1 }], -2), 0);
  assert.equal(badgeLabel(5), '5');
  assert.equal(badgeLabel(120), '99+');
});

const conv = (patch: Partial<Conversation>): Conversation => ({
  id: 'c1',
  other,
  status: 'accepted',
  requestedByMe: true,
  lastMessage: { text: 'hi  there\nfriend', at: '2026-11-01T10:00:00Z', fromMe: false },
  unread: 0,
  updatedAt: '2026-11-01T10:00:00Z',
  ...patch,
});

test('preview and status chip', () => {
  assert.equal(previewText(conv({})), 'hi there friend');
  assert.equal(previewText(conv({ lastMessage: { text: 'yo', at: '2026-11-01T10:00:00Z', fromMe: true } })), 'You: yo');
  assert.equal(previewText(conv({ lastMessage: null, status: 'pending', requestedByMe: true })), 'Request sent');
  assert.equal(rowStatus(conv({})), null);
  assert.equal(rowStatus(conv({ status: 'pending', requestedByMe: true })), 'Pending');
  assert.equal(rowStatus(conv({ status: 'pending', requestedByMe: false })), 'Request');
  assert.equal(rowStatus(conv({ status: 'declined', requestedByMe: true })), 'Not accepted');
});

test('parseBox', () => {
  assert.equal(parseBox('requests'), 'requests');
  assert.equal(parseBox(['requests', 'inbox']), 'requests');
  assert.equal(parseBox('inbox'), 'inbox');
  assert.equal(parseBox(undefined), 'inbox');
  assert.equal(parseBox('junk'), 'inbox');
});

/**
 * Admin announcements — the pure rules: the error the API returns, the
 * double-send and hourly limits, and the delivery loop (in-app notification
 * for everyone, phone notification for students with the app, a few at a
 * time). No database here, so every rule is unit-tested
 * (tests/unit/announcements-rules.test.ts). src/server/announcements/admin.ts
 * wires them to Postgres, createNotification and FCM.
 */

import { audienceKey, type AnnouncementAudience, type AnnouncementDraft } from "@/lib/announcements";

export class AnnouncementError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
  ) {
    super(detail);
    this.name = "AnnouncementError";
  }
}

/** The same admin, title, text and audience inside this window is a double send. */
export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
/** Real (non-test) sends allowed per admin per hour. */
export const SENDS_PER_HOUR = 10;
export const HOUR_MS = 60 * 60 * 1000;
/** Recipients handled at the same time while sending. */
export const SEND_CONCURRENCY = 10;

export type RecentSend = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  test: boolean;
  createdAt: Date;
};

function minutesText(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * Throws when this send must not go out:
 *   409 duplicate    — the same admin sent the same title + text to the same
 *                      audience less than 2 minutes ago (tests included);
 *   429 hourly_limit — the admin already made 10 real sends in the last hour
 *                      (test sends don't count and aren't limited).
 * `recent` is this admin's sends from the last hour, any order.
 */
export function checkSendGuards(
  recent: readonly RecentSend[],
  next: { draft: AnnouncementDraft; audience: AnnouncementAudience; test: boolean },
  now: number,
): void {
  const key = audienceKey(next.audience);
  const duplicate = recent.find(
    (send) =>
      now - send.createdAt.getTime() < DUPLICATE_WINDOW_MS &&
      send.title === next.draft.title &&
      send.body === next.draft.body &&
      audienceKey(send.audience) === key,
  );
  if (duplicate) {
    const ago = now - duplicate.createdAt.getTime();
    throw new AnnouncementError(
      409,
      "duplicate",
      `You sent this same announcement to the same students ${ago < 60_000 ? "less than a minute" : minutesText(ago)} ago. Change it, or wait ${minutesText(DUPLICATE_WINDOW_MS - ago)} to send it again.`,
    );
  }
  if (next.test) return;
  const lastHour = recent
    .filter((send) => !send.test && now - send.createdAt.getTime() < HOUR_MS)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (lastHour.length >= SENDS_PER_HOUR) {
    const freesAt = lastHour[lastHour.length - SENDS_PER_HOUR].createdAt.getTime() + HOUR_MS;
    throw new AnnouncementError(
      429,
      "hourly_limit",
      `You can send ${SENDS_PER_HOUR} announcements an hour. Try again in ${minutesText(freesAt - now)}.`,
    );
  }
}

/** Run `fn` over `items`, at most `limit` at a time. One failure never stops the rest. */
export async function forEachLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch {
        // Counted by the caller; keep going.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}

export type Recipient = { userId: string; hasPush: boolean };

export type DeliveryCounts = {
  /** Students who got the in-app notification. */
  notified: number;
  /** Students we tried to reach on the phone (they had an app device). */
  pushAttempted: number;
  /** Students whose phone accepted it on at least one device. */
  pushDelivered: number;
};

export type DeliveryDeps = {
  notify: (userId: string) => Promise<void>;
  /** Returns how many of the student's devices took the push. */
  push: (userId: string) => Promise<{ attempted: number; delivered: number }>;
  pushConfigured: boolean;
  concurrency?: number;
};

/**
 * Deliver to every recipient: the in-app notification always, the phone
 * notification when push is configured and the student has a device. Each
 * recipient is independent — a failure is counted, never thrown.
 */
export async function deliverAnnouncement(recipients: readonly Recipient[], deps: DeliveryDeps): Promise<DeliveryCounts> {
  const counts: DeliveryCounts = { notified: 0, pushAttempted: 0, pushDelivered: 0 };
  await forEachLimited(recipients, deps.concurrency ?? SEND_CONCURRENCY, async (recipient) => {
    try {
      await deps.notify(recipient.userId);
      counts.notified += 1;
    } catch {
      // The phone notification still goes out.
    }
    if (!deps.pushConfigured || !recipient.hasPush) return;
    counts.pushAttempted += 1;
    try {
      const result = await deps.push(recipient.userId);
      if (result.delivered > 0) counts.pushDelivered += 1;
    } catch {
      // Counted as attempted, not delivered.
    }
  });
  return counts;
}

/**
 * localStorage keys for per-user client caches.
 *
 * Shared phones and family tablets are the norm for our students, so anything
 * cached on-device for a signed-in user must be keyed by that user. The old
 * global keys (`origin_notifications`, `origin_pdf_notes_<url>`) showed one
 * student's notifications and private PDF notes to the next one to sign in.
 * Legacy PDF notes are claimed once by the first signed-in reader.
 */

import type { Notification } from "@/types";

/** Pre-namespacing global cache; removed on sight (the server re-hydrates). */
export const LEGACY_NOTIFICATIONS_KEY = "origin_notifications";

export function notificationsStorageKey(userId: string): string {
  return `origin_notifications:${userId}`;
}

/** Private study notes for one PDF, per user. */
export function pdfNotesStorageKey(userId: string | null | undefined, url: string): string {
  return `origin_pdf_notes:${userId || "guest"}:${url.replace(/[^a-z0-9]/gi, "_")}`;
}

/** Pre-namespacing key for a PDF's notes (URL only, no user). */
export function legacyPdfNotesStorageKey(url: string): string {
  return `origin_pdf_notes_${url.replace(/[^a-z0-9]/gi, "_")}`;
}

/**
 * Reads a PDF's notes for this user, claiming notes written under the old
 * URL-only key once: on a signed-in user's first load, legacy notes move to
 * their key (only when it is still empty) and the legacy key is deleted, so
 * no later account on the device can claim them too. Guests never claim.
 */
export function loadPdfNotes(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null,
  userId: string | null | undefined,
  url: string,
): string | null {
  if (!storage) return null;
  try {
    const key = pdfNotesStorageKey(userId, url);
    const current = storage.getItem(key);
    if (current || !userId) return current;
    const legacyKey = legacyPdfNotesStorageKey(url);
    const legacy = storage.getItem(legacyKey);
    if (!legacy) return current;
    storage.setItem(key, legacy);
    storage.removeItem(legacyKey);
    return legacy;
  } catch {
    return null;
  }
}

/** Parses a cached notification list; anything malformed yields []. */
export function parseStoredNotifications(raw: string | null): Notification[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is Record<string, unknown> => Boolean(n) && typeof n === "object" && typeof n.id === "string")
      .map((n) => ({ ...(n as unknown as Notification), createdAt: new Date(String(n.createdAt)) }))
      .filter((n) => !Number.isNaN(n.createdAt.getTime()));
  } catch {
    return [];
  }
}

/**
 * Drops a user's on-device caches at sign-out / session end. Their private
 * PDF notes are deliberately kept: they exist only on this device, and
 * namespacing already hides them from anyone else.
 */
export function clearUserLocalCaches(
  storage: Pick<Storage, "removeItem"> | null,
  userId: string | null | undefined,
): void {
  if (!storage) return;
  try {
    storage.removeItem(LEGACY_NOTIFICATIONS_KEY);
    if (userId) storage.removeItem(notificationsStorageKey(userId));
  } catch {
    // blocked storage
  }
}

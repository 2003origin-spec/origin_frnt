/// <reference lib="webworker" />
/**
 * Origin NOW offer alerts in the service worker (decision B85). Pushes carry
 * no payload: the worker asks the server for the solver's current offer and
 * shows it; tapping focuses (or opens) the shift screen. Kept apart from the
 * offline-cache code in sw.ts, which never routes /api requests.
 */

export const NOW_SHIFT_URL = "/now/solver";
export const NOW_OFFER_TAG = "origin-now-offer";

type CurrentOffer = { offer: { expiresAt: string; card?: { subject?: string; difficulty?: string; priceCoins?: number } } | null };

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the alert says for the offer the server reports (exported for tests). */
export function offerNotification(body: CurrentOffer | null, nowMs: number): { title: string; body: string } {
  const offer = body?.offer;
  if (!offer) {
    return { title: "Origin NOW", body: "A doubt was offered to you. Open your shift to see if it is still waiting." };
  }
  const seconds = Math.max(0, Math.round((Date.parse(offer.expiresAt) - nowMs) / 1000));
  const subject = offer.card?.subject ? title(offer.card.subject) : "A";
  const difficulty = offer.card?.difficulty ? ` · ${title(offer.card.difficulty)}` : "";
  return {
    title: `New ${subject} doubt${difficulty}`,
    body: seconds > 0 ? `Tap to open your shift: ${seconds} seconds to accept.` : "Tap to open your shift.",
  };
}

export function installNowPushHandlers(self: ServiceWorkerGlobalScope): void {
  self.addEventListener("push", (event) => {
    event.waitUntil(
      (async () => {
        let body: CurrentOffer | null = null;
        try {
          const res = await fetch("/api/now/helper/offers/current", { credentials: "include", cache: "no-store" });
          if (res.ok) body = (await res.json()) as CurrentOffer;
        } catch {
          // Signed out or offline: still show the generic alert (browsers require one per push).
        }
        const note = offerNotification(body, Date.now());
        await self.registration.showNotification(note.title, {
          body: note.body,
          tag: NOW_OFFER_TAG,
          requireInteraction: true,
          icon: "/icon.png",
          data: { url: NOW_SHIFT_URL },
        });
      })(),
    );
  });

  self.addEventListener("notificationclick", (event) => {
    if (event.notification.tag !== NOW_OFFER_TAG) return;
    event.notification.close();
    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const shift = windows.find((w) => new URL(w.url).pathname === NOW_SHIFT_URL);
        if (shift) {
          await shift.focus();
          return;
        }
        await self.clients.openWindow(NOW_SHIFT_URL);
      })(),
    );
  });
}

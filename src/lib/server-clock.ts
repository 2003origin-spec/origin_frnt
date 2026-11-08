/**
 * Server-clock correction for exam timers.
 *
 * Students' phones are often minutes off (manually set clocks, no network
 * time). An uncorrected fast clock makes a timer auto-submit early; a slow one
 * shows "Starting in" over a test that is already running. `skewMs` is
 * client − server, so `Date.now() - skewMs` is the server's "now".
 */

export type ServerAnchoredTimerSource = {
  startedAt: string;
  durationSeconds: number;
  skewMs?: number;
};

/**
 * client − server offset from one server timestamp.
 *
 * With `sentAtMs` (a fetch issued at that client time and answered now), the
 * server is assumed to have read its clock half-way through the round trip.
 * Without it (a timestamp rendered into the page), transport delay counts as
 * skew, which only ever makes the corrected clock run *behind* the server:
 * the timer then shows a little more time, never less, and the server's own
 * deadline grace still applies.
 */
export function estimateClockSkewMs(input: { clientNowMs: number; serverNowMs: number; sentAtMs?: number }): number {
  const { clientNowMs, serverNowMs, sentAtMs } = input;
  if (!Number.isFinite(serverNowMs) || !Number.isFinite(clientNowMs)) return 0;
  if (sentAtMs !== undefined && Number.isFinite(sentAtMs) && sentAtMs <= clientNowMs) {
    return sentAtMs + (clientNowMs - sentAtMs) / 2 - serverNowMs;
  }
  return clientNowMs - serverNowMs;
}

export function serverNowFrom(skewMs: number | undefined, clientNowMs: number): number {
  return clientNowMs - (skewMs ?? 0);
}

export function computeRemainingSeconds(source: ServerAnchoredTimerSource, clientNowMs: number): number {
  const startedAtMs = new Date(source.startedAt).getTime();
  const remainingMs = source.durationSeconds * 1000 - (serverNowFrom(source.skewMs, clientNowMs) - startedAtMs);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * A page-rendered server time can be minutes old: the service worker serves
 * a cached render after its 3 s network timeout, and the router's back/forward
 * cache restores an old payload. That age would all count as skew, making the
 * room timer run late by that much with no bound. So a rendered timestamp is
 * only trusted for a small offset, until a live round trip measures the real
 * one.
 */
export const MAX_RENDER_SKEW_MS = 30_000;

/** Skew from a page-rendered server time, or 0 when it implies more than MAX_RENDER_SKEW_MS. */
export function provisionalSkewFromRender(input: { clientNowMs: number; serverNowMs: number }): number {
  const skew = estimateClockSkewMs(input);
  return Math.abs(skew) <= MAX_RENDER_SKEW_MS ? skew : 0;
}

export type MeasuredSkew = {
  skewMs: number;
  /** Half the round trip: the most the midpoint estimate can be off by. */
  uncertaintyMs: number;
};

/**
 * Skew from an uncached fetch: sent at `sentAtMs`, answered at `receivedAtMs`
 * (both device clock) with the server's clock reading `serverNowMs`. Null when
 * the inputs are unusable.
 */
export function skewFromRoundTrip(input: {
  sentAtMs: number;
  receivedAtMs: number;
  serverNowMs: unknown;
}): MeasuredSkew | null {
  const { sentAtMs, receivedAtMs } = input;
  const serverNowMs = typeof input.serverNowMs === "number" ? input.serverNowMs : Number.NaN;
  if (![sentAtMs, receivedAtMs, serverNowMs].every(Number.isFinite)) return null;
  if (receivedAtMs < sentAtMs) return null;
  return {
    skewMs: estimateClockSkewMs({ sentAtMs, clientNowMs: receivedAtMs, serverNowMs }),
    uncertaintyMs: (receivedAtMs - sentAtMs) / 2,
  };
}

/** Keeps the tighter of two measurements (a shorter round trip is more exact). */
export function betterSkew(current: MeasuredSkew | null, next: MeasuredSkew | null): MeasuredSkew | null {
  if (!next) return current;
  if (!current) return next;
  return next.uncertaintyMs < current.uncertaintyMs ? next : current;
}

/**
 * Short-lived signed ticket for the origin-ai voice WebSocket (bug U2).
 *
 * The browser dials origin-ai's `/api/v1/voice/ws` directly, so the usual
 * Next → Python service-token path cannot authenticate it. Instead Next mints a
 * 60-second HMAC ticket for the logged-in user and the Python side verifies it
 * BEFORE accepting the socket (`origin-ai/app/auth/ws_ticket.py`). Both sides
 * derive the signing key from the shared `ORIGIN_AI_SERVICE_TOKEN`, so no new
 * secret is needed.
 *
 * Ticket: `v1.<base64url(userId)>.<expUnixSec>.<nonceHex>.<sigHex>`
 *   key = HMAC-SHA256(ORIGIN_AI_SERVICE_TOKEN, "origin-ai:ws-ticket:v1")
 *   sig = HMAC-SHA256(key, `${userId}|${exp}|${nonce}`)
 *
 * The algorithm here must stay byte-for-byte identical to the Python verifier.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { readRequiredServiceToken } from "@/server/service-auth";

export const WS_TICKET_TTL_SECONDS = 60;
export const WS_TICKET_VERSION = "v1";
const WS_TICKET_KEY_LABEL = "origin-ai:ws-ticket:v1";

function ticketKey(secret: string): Buffer {
  return createHmac("sha256", secret).update(WS_TICKET_KEY_LABEL).digest();
}

function signTicket(secret: string, userId: string, exp: number, nonce: string): string {
  return createHmac("sha256", ticketKey(secret)).update(`${userId}|${exp}|${nonce}`).digest("hex");
}

export interface MintedWsTicket {
  ticket: string;
  /** Unix seconds at which the ticket stops being accepted. */
  expiresAt: number;
  expiresInSeconds: number;
}

export function mintOriginAiWsTicket(
  userId: string,
  options: { now?: number; secret?: string } = {},
): MintedWsTicket {
  const trimmed = userId.trim();
  if (!trimmed) {
    throw new Error("Cannot mint a voice ticket without a user id.");
  }
  const secret = options.secret ?? readRequiredServiceToken("ORIGIN_AI_SERVICE_TOKEN");
  const nowMs = options.now ?? Date.now();
  const exp = Math.floor(nowMs / 1000) + WS_TICKET_TTL_SECONDS;
  const nonce = randomBytes(8).toString("hex");
  const sig = signTicket(secret, trimmed, exp, nonce);
  const ticket = [
    WS_TICKET_VERSION,
    Buffer.from(trimmed, "utf8").toString("base64url"),
    String(exp),
    nonce,
    sig,
  ].join(".");
  return { ticket, expiresAt: exp, expiresInSeconds: WS_TICKET_TTL_SECONDS };
}

/**
 * Returns the user id for a valid, unexpired ticket, or `null`. Never throws.
 * Mirrors the Python verifier; exists mainly so the roundtrip is unit-testable
 * from the TypeScript side.
 */
export function verifyOriginAiWsTicket(
  ticket: string | null | undefined,
  options: { now?: number; secret?: string } = {},
): string | null {
  let secret: string;
  try {
    secret = options.secret ?? readRequiredServiceToken("ORIGIN_AI_SERVICE_TOKEN");
  } catch {
    return null;
  }
  if (!secret) return null;

  const parts = (ticket ?? "").split(".");
  if (parts.length !== 5 || parts[0] !== WS_TICKET_VERSION) return null;
  const [, uidB64, expRaw, nonce, sig] = parts;
  if (!/^\d{1,12}$/.test(expRaw) || !/^[0-9a-f]{16}$/.test(nonce) || !/^[0-9a-f]{64}$/.test(sig)) {
    return null;
  }

  let userId: string;
  try {
    userId = Buffer.from(uidB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!userId) return null;

  const exp = Number(expRaw);
  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  if (!Number.isFinite(exp) || exp < nowSec) return null;

  const expected = signTicket(secret, userId, exp, nonce);
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

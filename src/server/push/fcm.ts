/**
 * FCM HTTP v1 sender (plan §5.5) — deliberately WITHOUT firebase-admin.
 *
 * The project already depends on google-auth-library (Google login), whose
 * JWT client can mint service-account access tokens for the
 * firebase.messaging scope; sends are then plain HTTPS calls to the FCM v1
 * endpoint. Zero new dependencies, no Firebase SDK in the web bundle.
 *
 * Env (all three required to activate; otherwise every send no-ops):
 *   FCM_PROJECT_ID    — Firebase project id
 *   FCM_CLIENT_EMAIL  — service-account client_email
 *   FCM_PRIVATE_KEY   — service-account private_key (\n-escaped in Vercel)
 *
 * Tokens FCM rejects as UNREGISTERED/invalid are pruned from the registry so
 * the table self-heals (ledger #52).
 */

import { JWT } from "google-auth-library";

import { listActiveDeviceTokens, pruneDeviceToken } from "@/server/push/device-tokens";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export type PushMessage = {
  title: string;
  body: string;
  /** In-app path the shell navigates to on tap, e.g. "/dpp" (ledger #53). */
  route?: string;
  /** Extra string data — FCM data payloads are string→string. */
  data?: Record<string, string>;
};

export type PushSendResult = {
  attempted: number;
  delivered: number;
  pruned: number;
};

function projectId(): string | null {
  return process.env.FCM_PROJECT_ID?.trim() || null;
}

export function isPushConfigured(): boolean {
  return Boolean(
    projectId() && process.env.FCM_CLIENT_EMAIL?.trim() && process.env.FCM_PRIVATE_KEY?.trim(),
  );
}

let jwtClient: JWT | null = null;

function getJwtClient(): JWT | null {
  if (!isPushConfigured()) return null;
  if (!jwtClient) {
    jwtClient = new JWT({
      email: process.env.FCM_CLIENT_EMAIL!.trim(),
      key: process.env.FCM_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      scopes: [FCM_SCOPE],
    });
  }
  return jwtClient;
}

function buildFcmPayload(token: string, message: PushMessage) {
  return {
    message: {
      token,
      notification: { title: message.title, body: message.body },
      data: {
        ...(message.data ?? {}),
        ...(message.route ? { route: message.route } : {}),
      },
      android: {
        // Default priority; bump per-category later if a class of message
        // genuinely needs Doze-piercing delivery (ledger #43).
        priority: "NORMAL" as const,
      },
    },
  };
}

/** True when FCM says the token is dead and should be pruned. */
function isUnregisteredTokenError(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404) return true;
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  const text = typeof data === "string" ? data : JSON.stringify(data ?? "");
  return text.includes("UNREGISTERED") || text.includes("InvalidRegistration");
}

async function sendToToken(client: JWT, token: string, message: PushMessage): Promise<"ok" | "pruned" | "failed"> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`;
  try {
    await client.request({ url, method: "POST", data: buildFcmPayload(token, message) });
    return "ok";
  } catch (error) {
    if (isUnregisteredTokenError(error)) {
      await pruneDeviceToken(token).catch(() => {});
      return "pruned";
    }
    console.error("[push] FCM send failed", error instanceof Error ? error.message : error);
    return "failed";
  }
}

/**
 * Send to every active device of a user. Safe to call unconditionally from
 * product events — no-ops (attempted: 0) when push isn't configured or the
 * user has no registered devices.
 */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<PushSendResult> {
  const client = getJwtClient();
  if (!client) return { attempted: 0, delivered: 0, pruned: 0 };

  const tokens = await listActiveDeviceTokens(userId);
  if (tokens.length === 0) return { attempted: 0, delivered: 0, pruned: 0 };

  const outcomes = await Promise.allSettled(tokens.map((token) => sendToToken(client, token, message)));
  let delivered = 0;
  let pruned = 0;
  for (const outcome of outcomes) {
    if (outcome.status !== "fulfilled") continue;
    if (outcome.value === "ok") delivered += 1;
    if (outcome.value === "pruned") pruned += 1;
  }
  return { attempted: tokens.length, delivered, pruned };
}

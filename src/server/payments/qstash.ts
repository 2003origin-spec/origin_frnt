/**
 * QStash adapter for payment-outbox delivery.
 *
 * QStash is an acceleration layer only. The Postgres outbox remains the
 * durable source of work, and the minute drain is the backstop when QStash is
 * absent or unavailable. No payment correctness depends on this module.
 */

import { Client, Receiver, type PublishResponse } from "@upstash/qstash";

const DISPATCH_PATH = "/api/internal/payments/dispatch";

export type QStashClientLike = Pick<Client, "publishJSON">;
export type QStashReceiverLike = Pick<Receiver, "verify">;

export type PublishOutboxResult = {
  published: boolean;
  messageId: string | null;
  reason?: "not_configured";
};

export type QStashPublishDeps = {
  client?: QStashClientLike;
  destination?: string;
  internalToken?: string;
};

export type QStashVerifyDeps = {
  receiver?: QStashReceiverLike;
  /** Test/adapter override for URL binding; production uses request.url. */
  url?: string;
};

let clientOverride: QStashClientLike | null | undefined;

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function siteOrigin(): string | null {
  const configured = env("NEXT_PUBLIC_SITE_URL");
  if (configured) return configured.replace(/\/$/u, "");
  const vercel = env("VERCEL_URL");
  return vercel ? `https://${vercel}` : null;
}

/** Whether QStash can publish and the destination can be constructed. */
export function isQStashConfigured(): boolean {
  return Boolean(env("QSTASH_TOKEN") && siteOrigin() && env("INTERNAL_CRON_TOKEN"));
}

/** True when the signing keys needed by the inbound receiver are configured. */
export function isQStashSignatureVerificationConfigured(): boolean {
  return Boolean(env("QSTASH_CURRENT_SIGNING_KEY") || env("QSTASH_NEXT_SIGNING_KEY"));
}

function defaultDestination(): string | null {
  const origin = siteOrigin();
  return origin ? `${origin}${DISPATCH_PATH}` : null;
}

function getClient(): QStashClientLike | null {
  if (clientOverride !== undefined) return clientOverride;
  const token = env("QSTASH_TOKEN");
  return token ? new Client({ token, enableTelemetry: false }) : null;
}

/** Test seam; production code should rely on env-backed resolution. */
export function __setQStashClientForTests(client: QStashClientLike | null): void {
  clientOverride = client;
}

/** Restore env-backed resolution after a test. */
export function __resetQStashClientForTests(): void {
  clientOverride = undefined;
}

/**
 * Best-effort publish of one outbox row. A missing QStash configuration is a
 * normal result: the cron drain will pick up the row later.
 */
export async function publishOutbox(
  outboxId: string,
  deps: QStashPublishDeps = {},
): Promise<PublishOutboxResult> {
  const id = outboxId.trim();
  if (!id) throw new Error("outboxId is required");

  const client = deps.client ?? getClient();
  const destination = deps.destination ?? defaultDestination();
  const internalToken = deps.internalToken ?? env("INTERNAL_CRON_TOKEN");
  if (!client || !destination || !internalToken) {
    return { published: false, messageId: null, reason: "not_configured" };
  }

  const response = (await client.publishJSON({
    url: destination,
    body: { outboxId: id },
    // qstash-js maps this to Upstash-Deduplication-Id at the wire boundary.
    deduplicationId: `payment-outbox:${id}`,
    retries: 3,
    headers: {
      "Upstash-Forward-Authorization": `Bearer ${internalToken}`,
    },
  })) as PublishResponse<unknown>;

  return { published: true, messageId: response.messageId ?? null };
}

/**
 * Verify an inbound QStash request. The raw body must be supplied when the
 * caller has already consumed the request stream; otherwise a clone is read.
 * URL binding is retained in production so a signed message cannot be replayed
 * against another route.
 */
export async function verifyQStashSignature(
  request: Request,
  rawBody?: string,
  deps: QStashVerifyDeps = {},
): Promise<boolean> {
  const currentSigningKey = env("QSTASH_CURRENT_SIGNING_KEY");
  const nextSigningKey = env("QSTASH_NEXT_SIGNING_KEY");
  const signature = request.headers.get("upstash-signature");
  if (!signature || (!currentSigningKey && !nextSigningKey)) return false;

  const body = rawBody ?? (await request.clone().text());
  const receiver =
    deps.receiver ??
    new Receiver({
      currentSigningKey: currentSigningKey ?? undefined,
      nextSigningKey: nextSigningKey ?? undefined,
    });
  try {
    return await receiver.verify({
      signature,
      body,
      url: deps.url ?? request.url,
      upstashRegion: request.headers.get("upstash-region") ?? undefined,
    });
  } catch {
    return false;
  }
}

export { DISPATCH_PATH as PAYMENTS_DISPATCH_PATH };

/**
 * WhatsApp notification channel (Phase 7). A thin adapter over a Cloud-API-style
 * HTTP endpoint (Meta WhatsApp Cloud API, or any BSP that mirrors its shape).
 *
 * Ships DARK: no-ops when the env is not configured, exactly like the push
 * channel does without FCM creds — so the code path is live and safe to wire
 * into fan-outs now, and starts sending the moment real BSP credentials are set.
 *
 * Env:
 *   WHATSAPP_API_URL    e.g. https://graph.facebook.com/v20.0/<phone-number-id>/messages
 *   WHATSAPP_API_TOKEN  bearer token for the BSP / Cloud API
 */

export function isWhatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
}

export interface WhatsappMessage {
  /** Recipient in E.164 (e.g. +9198…). */
  to: string;
  /** Plain-text body (session message). Template sends can be added later. */
  body: string;
}

export interface WhatsappSendResult {
  sent: boolean;
  skipped?: "unconfigured" | "no_recipient";
  error?: string;
}

/**
 * Best-effort send. Never throws — mirrors sendPushToUser's contract so a
 * fan-out can `.catch(() => undefined)` and a channel blip never breaks the
 * caller. Returns a skipped result (not an error) when unconfigured.
 */
export async function sendWhatsapp(message: WhatsappMessage): Promise<WhatsappSendResult> {
  if (!isWhatsappConfigured()) return { sent: false, skipped: "unconfigured" };
  const to = (message.to || "").replace(/[^\d+]/g, "");
  if (!to) return { sent: false, skipped: "no_recipient" };
  try {
    const res = await fetch(process.env.WHATSAPP_API_URL as string, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN as string}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message.body.slice(0, 4096) },
      }),
    });
    if (!res.ok) return { sent: false, error: `whatsapp ${res.status}` };
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "whatsapp send failed" };
  }
}

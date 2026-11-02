/**
 * Student messaging — FCM pushes (contract addendum 02/11/2026).
 *
 * Sent at the same moments as the in-app notifications, with the same rules:
 * a new request, an accepted request, and a new message only when its in-app
 * notice is created (at most one per conversation until the student reads it).
 *
 * Best-effort: nothing is sent when FCM isn't configured (FCM_PROJECT_ID /
 * FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY), and a failure is logged, never thrown,
 * so it can't block a send.
 */

import { isPushConfigured, sendPushToUser, type PushMessage } from "@/server/push/fcm";

export type MessagingPushKind = "message_request" | "message_accepted" | "message";

export const PUSH_PREVIEW_CHARS = 80;

/** The first 80 characters (code points, so an emoji is never split). */
export function pushPreview(text: string): string {
  return [...text.trim()].slice(0, PUSH_PREVIEW_CHARS).join("");
}

export function messagingPushLink(kind: MessagingPushKind, conversationId: string): string {
  return kind === "message_request" ? "/messages?box=requests" : `/messages/${conversationId}`;
}

/** Pure: the push for one moment. `name` is the student who caused it. */
export function buildMessagingPush(
  kind: MessagingPushKind,
  input: { name: string; conversationId: string; text?: string },
): PushMessage & { data: { type: MessagingPushKind; conversationId: string; link: string } } {
  const link = messagingPushLink(kind, input.conversationId);
  const data = { type: kind, conversationId: input.conversationId, link };
  const preview = pushPreview(input.text ?? "");
  if (kind === "message_request") {
    return { title: "Message request", body: `${input.name}: ${preview}`, route: link, data };
  }
  if (kind === "message_accepted") {
    return { title: `${input.name} accepted your request`, body: "", route: link, data };
  }
  return { title: input.name, body: preview, route: link, data };
}

/** Send one messaging push to every device of `userId`. Never throws. */
export async function sendMessagingPush(
  userId: string,
  kind: MessagingPushKind,
  input: { name: string; conversationId: string; text?: string },
): Promise<void> {
  if (!isPushConfigured()) return;
  try {
    await sendPushToUser(userId, buildMessagingPush(kind, input));
  } catch (error) {
    console.error("[messaging] push failed:", error instanceof Error ? error.message : error);
  }
}

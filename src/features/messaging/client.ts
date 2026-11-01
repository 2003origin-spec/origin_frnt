/**
 * Browser client for the website messaging API (`/api/messages/*`, cookie auth).
 *
 * Every call resolves to `{ ok, status, data }` instead of throwing on a refusal,
 * because the UI needs the refusal body: 409 `exists` carries `conversationId`,
 * 429 `daily_limit` carries `usage`, 403 `suspended` carries the end date.
 * Mutations go through `mutateJson` (CSRF header + one refresh-and-retry).
 */

import { attemptTokenRefresh } from '@/lib/api';
import { mutateJson } from '@/lib/csrf';

import type {
  BlockedPerson,
  ChatMessage,
  Conversation,
  InboxBox,
  InboxResponse,
  MessagingErrorBody,
  MessagingUsage,
  ReportReason,
  ThreadResponse,
} from './types';

const BASE = '/api/messages';

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: MessagingErrorBody };

const NETWORK_ERROR: MessagingErrorBody = { detail: 'Check your connection and try again.', code: 'network' };

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await res.json().catch(() => null)) as unknown;
  if (res.ok) return { ok: true, status: res.status, data: (body ?? {}) as T };
  const error: MessagingErrorBody =
    body && typeof body === 'object' ? (body as MessagingErrorBody) : {};
  if (!error.detail) {
    error.detail =
      res.status === 404 ? 'This isn’t available right now.' : 'Something went wrong. Try again in a moment.';
  }
  return { ok: false, status: res.status, error };
}

async function get<T>(path: string): Promise<ApiResult<T>> {
  try {
    const run = () => fetch(`${BASE}${path}`, { credentials: 'include', cache: 'no-store' });
    let res = await run();
    if (res.status === 401 && (await attemptTokenRefresh()) === 'ok') res = await run();
    return await toResult<T>(res);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

async function post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await mutateJson(`${BASE}${path}`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
    return await toResult<T>(res);
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
}

const enc = encodeURIComponent;

export function fetchInbox(box: InboxBox) {
  return get<InboxResponse>(`?box=${box}`);
}

export function fetchThread(id: string, opts: { before?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', opts.before);
  params.set('limit', String(opts.limit ?? 30));
  return get<ThreadResponse>(`/${enc(id)}?${params.toString()}`);
}

export function fetchUsage() {
  return get<{ usage: MessagingUsage }>('/usage');
}

export function fetchBlocked() {
  return get<{ people: BlockedPerson[] }>('/blocked');
}

export function startConversation(input: { username?: string; userId?: string; text: string }) {
  return post<{ conversation: Conversation; message: ChatMessage; usage: MessagingUsage }>('/start', input);
}

export function sendMessage(id: string, text: string) {
  return post<{ message: ChatMessage; usage: MessagingUsage }>(`/${enc(id)}`, { text });
}

export function respond(id: string, action: 'accept' | 'decline' | 'block') {
  return post<{ conversation: Conversation }>(`/${enc(id)}/${action}`);
}

export function markRead(id: string) {
  return post<{ ok: true }>(`/${enc(id)}/read`);
}

export function reportConversation(id: string, reason: ReportReason, note?: string) {
  return post<{ ok: true }>(`/${enc(id)}/report`, note ? { reason, note } : { reason });
}

export function unblock(userId: string) {
  return post<{ ok: true }>('/unblock', { userId });
}

// ── Drafts carried across a 409 `exists` redirect ───────────────────────────
// A student who writes a first message on a profile and already has a
// conversation lands in it with their text kept (session storage, never the URL).

const DRAFT_KEY = (id: string) => `origin_msg_draft:${id}`;

export function saveDraft(conversationId: string, text: string): void {
  try {
    if (text.trim()) sessionStorage.setItem(DRAFT_KEY(conversationId), text);
  } catch {
    /* storage blocked */
  }
}

export function takeDraft(conversationId: string): string {
  try {
    const text = sessionStorage.getItem(DRAFT_KEY(conversationId)) ?? '';
    sessionStorage.removeItem(DRAFT_KEY(conversationId));
    return text;
  } catch {
    return '';
  }
}

/** Tell the nav badge to refresh now (after reading, accepting, sending). */
export const MESSAGES_CHANGED_EVENT = 'origin:messages:changed';

export function announceMessagesChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MESSAGES_CHANGED_EVENT));
}

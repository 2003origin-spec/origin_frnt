/**
 * Student messaging — the API shapes the website reads from `/api/messages/*`
 * (the same shapes as `/api/mobile/messages/*`; see the messaging contract of
 * 01/11/2026 and its 02/11/2026 addendum). Client-safe: no server imports.
 */

export type MessagingPerson = {
  id: string;
  username: string | null;
  name: string;
  avatar: string | null;
};

export type MessagingUsage = {
  used: number;
  limit: number;
  premium: boolean;
  /** ISO instant of the next 00:00 IST. */
  resetsAt: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  fromMe: boolean;
  /** ISO instant. */
  at: string;
  units: number;
};

export type ConversationStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export type Conversation = {
  id: string;
  other: MessagingPerson;
  status: ConversationStatus;
  /** I sent the request (the first message). */
  requestedByMe: boolean;
  /** Only meaningful when status is `blocked` (addendum 02/11/2026). */
  blockedByMe?: boolean;
  lastMessage: { text: string; at: string; fromMe: boolean } | null;
  unread: number;
  updatedAt: string;
};

export type InboxBox = 'inbox' | 'requests';

export type InboxResponse = {
  conversations: Conversation[];
  requestCount: number;
  usage: MessagingUsage;
};

export type ThreadResponse = {
  conversation: Conversation;
  /** Oldest first. */
  messages: ChatMessage[];
  hasMore: boolean;
  usage: MessagingUsage;
};

export type BlockedPerson = {
  person: MessagingPerson;
  blockedAt: string;
  conversationId: string | null;
};

export const REPORT_REASONS = ['spam', 'abuse', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** `{ detail, code }` refusal body; 409 `exists` adds `conversationId`, 429 `daily_limit` adds `usage`. */
export type MessagingErrorBody = {
  detail?: string;
  code?: string;
  conversationId?: string;
  usage?: MessagingUsage;
};

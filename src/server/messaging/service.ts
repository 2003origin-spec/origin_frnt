/**
 * Student-to-student messaging — database work (USER database, `messaging` schema).
 *
 * The rules live in ./rules.ts; this module applies them inside transactions:
 *   - a conversation row is locked (FOR UPDATE) while its status changes or a
 *     message is added, so a request can't be answered twice at once;
 *   - the daily cap is ONE conditional UPDATE on messaging.daily_usage, in the
 *     same transaction as the message insert, so parallel sends can't pass it;
 *   - a conversation the viewer blocked, or one they are not part of, answers
 *     404 exactly like an id that never existed.
 *
 * Notifications are sent after COMMIT and are best-effort (createNotification
 * never throws). New-message notifications are deduped per conversation with
 * messaging.members.notice_pending: set when one is sent, cleared on read.
 */

import type { PoolClient } from "pg";

import { createNotification } from "@/server/notifications";
import { getEntitledSubjects } from "@/server/entitlements";
import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import {
  buildUsage,
  dailyLimitError,
  fitsDailyCap,
  MESSAGE_PAGE_DEFAULT,
  MESSAGE_PAGE_MAX,
  messageUnits,
  MessagingError,
  nextStatus,
  orderedPair,
  REPORT_NOTE_MAX_CHARS,
  sendDecision,
  usageWindow,
  type ConversationAction,
  type ConversationStatus,
  type ReportReason,
  type Usage,
} from "./rules";
import { ensureMessagingSchema } from "./schema";

// ── Types (the API contract) ────────────────────────────────────────────────

export type Viewer = { id: string; name: string };

export type Person = { id: string; username: string | null; name: string; avatar: string | null };

export type Message = { id: string; text: string; fromMe: boolean; at: string; units: number };

export type Conversation = {
  id: string;
  other: Person;
  status: ConversationStatus;
  requestedByMe: boolean;
  lastMessage: { text: string; at: string; fromMe: boolean } | null;
  unread: number;
  updatedAt: string;
};

export type Box = "inbox" | "requests";

// ── Helpers ─────────────────────────────────────────────────────────────────

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const notFound = () => new MessagingError(404, "not_found", "That conversation doesn't exist.");
const noStudent = () => new MessagingError(404, "not_found", "We couldn't find that student.");
const cantMessage = () => new MessagingError(403, "blocked", "You can't message this student.");

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Premium = any active subscription or subject grant (entitlements non-empty). */
export async function isPremiumStudent(userId: string): Promise<boolean> {
  try {
    return (await getEntitledSubjects(userId)).length > 0;
  } catch (error) {
    console.error("[messaging] entitlement lookup failed; using the free cap:", error instanceof Error ? error.message : error);
    return false;
  }
}

async function usedToday(db: Pick<PoolClient, "query">, userId: string, day: string): Promise<number> {
  const result = await db.query(`SELECT units FROM messaging.daily_usage WHERE user_id = $1 AND ist_day = $2::date`, [userId, day]);
  return Number(result.rows[0]?.units ?? 0);
}

export async function getUsage(viewer: Viewer, now: number = Date.now()): Promise<Usage> {
  await ensureMessagingSchema();
  const [used, premium] = await Promise.all([usedToday(pool(), viewer.id, usageWindow(now).day), isPremiumStudent(viewer.id)]);
  return buildUsage(used, premium, now);
}

/**
 * Spend `units` of today's budget inside the caller's transaction, or throw the
 * 429. The UPDATE row-locks the usage row, so two parallel sends queue here.
 */
async function spendUnits(client: PoolClient, userId: string, units: number, premium: boolean, now: number): Promise<Usage> {
  const { day } = usageWindow(now);
  const limit = buildUsage(0, premium, now).limit;
  await client.query(
    `INSERT INTO messaging.daily_usage (user_id, ist_day, units) VALUES ($1, $2::date, 0) ON CONFLICT (user_id, ist_day) DO NOTHING`,
    [userId, day],
  );
  const spent = await client.query(
    `UPDATE messaging.daily_usage SET units = units + $3, updated_at = now()
      WHERE user_id = $1 AND ist_day = $2::date AND units + $3 <= $4
      RETURNING units`,
    [userId, day, units, limit],
  );
  if (spent.rows.length === 0) {
    const used = await usedToday(client, userId, day);
    const usage = buildUsage(used, premium, now);
    // Same rule as the SQL above, kept in one readable place for tests.
    if (!fitsDailyCap(used, units, usage.limit)) throw dailyLimitError(usage, units);
    throw new Error("daily usage update matched no row");
  }
  return buildUsage(Number(spent.rows[0].units), premium, now);
}

// ── Reading conversations ───────────────────────────────────────────────────

/**
 * One conversation per row, seen from `$1` (the viewer): the other student,
 * the last message, and the unread count. Conversations the viewer blocked
 * are left out.
 */
const VIEW_BASE_SQL = `
  SELECT c.id, c.status, c.requested_by, c.updated_at,
         u.id AS other_id, u.username AS other_username, u.name AS other_name, u.avatar AS other_avatar,
         lm.body AS last_body, lm.created_at AS last_at, lm.sender_id AS last_sender,
         (SELECT COUNT(*)::int FROM messaging.messages x
           WHERE x.conversation_id = c.id AND x.sender_id <> $1
             AND x.created_at > COALESCE(m.last_read_at, to_timestamp(0))) AS unread
    FROM messaging.conversations c
    JOIN origin_users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    LEFT JOIN messaging.members m ON m.conversation_id = c.id AND m.user_id = $1
    LEFT JOIN LATERAL (
      SELECT body, created_at, sender_id FROM messaging.messages
       WHERE conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1
    ) lm ON TRUE
   WHERE (c.user_a = $1 OR c.user_b = $1)`;
const VIEW_SQL = `${VIEW_BASE_SQL}
     AND NOT EXISTS (SELECT 1 FROM messaging.blocks b WHERE b.blocker_id = $1 AND b.blocked_id = u.id)`;

/** inbox = accepted + the ones I asked for (pending/declined) + blocked ones I could see before. */
const INBOX_SQL = `
     AND (c.status = 'accepted'
          OR (c.requested_by = $1 AND c.status IN ('pending', 'declined'))
          OR (c.status = 'blocked' AND (c.accepted_at IS NOT NULL OR c.requested_by = $1)))`;
const REQUESTS_SQL = ` AND c.status = 'pending' AND c.requested_by <> $1`;
const LIST_LIMIT = 100;

function mapConversation(row: Record<string, unknown>, viewerId: string): Conversation {
  return {
    id: String(row.id),
    other: {
      id: String(row.other_id),
      username: (row.other_username as string | null) ?? null,
      name: String(row.other_name ?? "Student"),
      avatar: (row.other_avatar as string | null) ?? null,
    },
    status: row.status as ConversationStatus,
    requestedByMe: row.requested_by === viewerId,
    lastMessage:
      row.last_body == null
        ? null
        : { text: String(row.last_body), at: iso(row.last_at), fromMe: row.last_sender === viewerId },
    unread: Number(row.unread ?? 0),
    updatedAt: iso(row.updated_at),
  };
}

async function viewConversation(db: Pick<PoolClient, "query">, viewerId: string, id: string): Promise<Conversation | null> {
  const result = await db.query(`${VIEW_SQL} AND c.id = $2`, [viewerId, id]);
  return result.rows[0] ? mapConversation(result.rows[0], viewerId) : null;
}

export async function listConversations(
  viewer: Viewer,
  box: Box,
  now: number = Date.now(),
): Promise<{ conversations: Conversation[]; requestCount: number; usage: Usage }> {
  await ensureMessagingSchema();
  const p = pool();
  const [list, requests, usage] = await Promise.all([
    p.query(`${VIEW_SQL}${box === "requests" ? REQUESTS_SQL : INBOX_SQL} ORDER BY c.updated_at DESC, c.id DESC LIMIT ${LIST_LIMIT}`, [
      viewer.id,
    ]),
    p.query(
      `SELECT COUNT(*)::int AS n FROM messaging.conversations c
        WHERE (c.user_a = $1 OR c.user_b = $1) AND c.status = 'pending' AND c.requested_by <> $1`,
      [viewer.id],
    ),
    getUsage(viewer, now),
  ]);
  return {
    conversations: list.rows.map((row) => mapConversation(row, viewer.id)),
    requestCount: Number(requests.rows[0]?.n ?? 0),
    usage,
  };
}

function mapMessage(row: Record<string, unknown>, viewerId: string): Message {
  return {
    id: String(row.id),
    text: String(row.body),
    fromMe: row.sender_id === viewerId,
    at: iso(row.created_at),
    units: Number(row.units),
  };
}

export async function getConversation(
  viewer: Viewer,
  id: string,
  options: { before?: string | null; limit?: number | null } = {},
  now: number = Date.now(),
): Promise<{ conversation: Conversation; messages: Message[]; hasMore: boolean; usage: Usage }> {
  await ensureMessagingSchema();
  const conversation = await viewConversation(pool(), viewer.id, id);
  if (!conversation) throw notFound();
  const before = options.before && Number.isFinite(Date.parse(options.before)) ? new Date(options.before).toISOString() : null;
  const raw = Number(options.limit ?? MESSAGE_PAGE_DEFAULT);
  const limit = Number.isFinite(raw) ? Math.min(MESSAGE_PAGE_MAX, Math.max(1, Math.floor(raw))) : MESSAGE_PAGE_DEFAULT;
  const [rows, usage] = await Promise.all([
    pool().query(
      `SELECT id, body, sender_id, created_at, units FROM messaging.messages
        WHERE conversation_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
        ORDER BY created_at DESC, id DESC LIMIT $3`,
      [id, before, limit + 1],
    ),
    getUsage(viewer, now),
  ]);
  const hasMore = rows.rows.length > limit;
  const messages = rows.rows.slice(0, limit).reverse().map((row) => mapMessage(row, viewer.id));
  return { conversation, messages, hasMore, usage };
}

// ── Sending ─────────────────────────────────────────────────────────────────

type Target = { id: string; name: string; role: string; accountStatus: string };

async function findStudent(input: { username?: string | null; userId?: string | null }): Promise<Target | null> {
  const userId = input.userId?.trim();
  const username = input.username?.trim().replace(/^@/, "");
  if (!userId && !username) return null;
  const result = await pool().query(
    `SELECT id, name, role, account_status FROM origin_users
      WHERE ${userId ? "id = $1" : "LOWER(username) = LOWER($1)"} LIMIT 1`,
    [userId || username],
  );
  const row = result.rows[0];
  return row
    ? { id: String(row.id), name: String(row.name ?? "Student"), role: String(row.role), accountStatus: String(row.account_status ?? "active") }
    : null;
}

async function blockedEitherWay(db: Pick<PoolClient, "query">, a: string, b: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM messaging.blocks
      WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
    [a, b],
  );
  return result.rows.length > 0;
}

async function insertMessage(
  client: PoolClient,
  conversationId: string,
  senderId: string,
  text: string,
  units: number,
  now: number,
): Promise<Record<string, unknown>> {
  const result = await client.query(
    `INSERT INTO messaging.messages (id, conversation_id, sender_id, body, units, ist_day, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7::timestamptz)
     RETURNING id, body, sender_id, created_at, units`,
    [createPrefixedId("msg"), conversationId, senderId, text, units, usageWindow(now).day, new Date(now).toISOString()],
  );
  return result.rows[0];
}

const conversationHref = (id: string) => `/messages/${id}`;

/** The first message to a student: opens a request. */
export async function startConversation(
  viewer: Viewer,
  input: { username?: string | null; userId?: string | null; text: string },
  now: number = Date.now(),
): Promise<{ conversation: Conversation; message: Message; usage: Usage }> {
  await ensureMessagingSchema();
  const target = await findStudent(input);
  if (!target || target.accountStatus !== "active") throw noStudent();
  if (target.id === viewer.id) throw new MessagingError(409, "self", "You can't message yourself.");
  if (target.role !== "student") throw new MessagingError(403, "not_student", "You can only message other students.");
  if (await blockedEitherWay(pool(), viewer.id, target.id)) throw cantMessage();

  const units = messageUnits(input.text);
  const premium = await isPremiumStudent(viewer.id);
  const [userA, userB] = orderedPair(viewer.id, target.id);
  const exists = (conversationId: string) =>
    new MessagingError(409, "exists", "You already have a conversation with this student.", { conversationId });

  const outcome = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM messaging.conversations WHERE user_a = $1 AND user_b = $2`, [userA, userB]);
    if (existing.rows[0]) throw exists(String(existing.rows[0].id));
    const usage = await spendUnits(client, viewer.id, units, premium, now);
    const at = new Date(now).toISOString();
    const inserted = await client.query(
      `INSERT INTO messaging.conversations (id, user_a, user_b, requested_by, status, created_at, updated_at, last_message_at)
       VALUES ($1, $2, $3, $4, 'pending', $5::timestamptz, $5::timestamptz, $5::timestamptz)
       ON CONFLICT (user_a, user_b) DO NOTHING
       RETURNING id`,
      [createPrefixedId("conv"), userA, userB, viewer.id, at],
    );
    if (!inserted.rows[0]) {
      // The other student started one at the same instant.
      const raced = await client.query(`SELECT id FROM messaging.conversations WHERE user_a = $1 AND user_b = $2`, [userA, userB]);
      throw exists(String(raced.rows[0]?.id ?? ""));
    }
    const conversationId = String(inserted.rows[0].id);
    await client.query(
      `INSERT INTO messaging.members (conversation_id, user_id, last_read_at, notice_pending)
       VALUES ($1, $2, $4::timestamptz, false), ($1, $3, to_timestamp(0), true)`,
      [conversationId, viewer.id, target.id, at],
    );
    const message = await insertMessage(client, conversationId, viewer.id, input.text, units, now);
    return { conversationId, message, usage };
  });

  await createNotification(target.id, {
    type: "info",
    title: "New message request",
    message: `${viewer.name} wants to message you.`,
    href: "/messages?box=requests",
  });
  const conversation = await viewConversation(pool(), viewer.id, outcome.conversationId);
  if (!conversation) throw notFound();
  return { conversation, message: mapMessage(outcome.message, viewer.id), usage: outcome.usage };
}

type LockedConversation = { id: string; status: ConversationStatus; requestedBy: string; otherId: string; otherName: string };

/** Lock the viewer's conversation row (404 if it isn't theirs, or they blocked the other student). */
async function lockConversation(client: PoolClient, viewerId: string, id: string, options: { allowHidden?: boolean } = {}) {
  const result = await client.query(
    `SELECT c.id, c.status, c.requested_by, u.id AS other_id, u.name AS other_name, u.account_status AS other_status,
            EXISTS (SELECT 1 FROM messaging.blocks b WHERE b.blocker_id = $2 AND b.blocked_id = u.id) AS i_blocked
       FROM messaging.conversations c
       JOIN origin_users u ON u.id = CASE WHEN c.user_a = $2 THEN c.user_b ELSE c.user_a END
      WHERE c.id = $1 AND (c.user_a = $2 OR c.user_b = $2)
      FOR UPDATE OF c`,
    [id, viewerId],
  );
  const row = result.rows[0];
  if (!row || (row.i_blocked && !options.allowHidden)) throw notFound();
  const locked: LockedConversation = {
    id: String(row.id),
    status: row.status as ConversationStatus,
    requestedBy: String(row.requested_by),
    otherId: String(row.other_id),
    otherName: String(row.other_name ?? "Student"),
  };
  return { locked, otherActive: (row.other_status ?? "active") === "active" };
}

/** A message in an existing conversation. */
export async function sendMessage(
  viewer: Viewer,
  id: string,
  text: string,
  now: number = Date.now(),
): Promise<{ message: Message; usage: Usage }> {
  await ensureMessagingSchema();
  const units = messageUnits(text);
  const premium = await isPremiumStudent(viewer.id);
  const at = new Date(now).toISOString();

  const outcome = await withTransaction(async (client) => {
    const { locked, otherActive } = await lockConversation(client, viewer.id, id);
    if (!otherActive) throw cantMessage();
    const { implicitAccept } = sendDecision(locked, viewer.id, locked.otherName);
    const usage = await spendUnits(client, viewer.id, units, premium, now);
    const message = await insertMessage(client, id, viewer.id, text, units, now);
    await client.query(
      `UPDATE messaging.conversations
          SET updated_at = $2::timestamptz, last_message_at = $2::timestamptz,
              status = CASE WHEN $3::boolean THEN 'accepted' ELSE status END,
              accepted_at = CASE WHEN $3::boolean THEN $2::timestamptz ELSE accepted_at END
        WHERE id = $1`,
      [id, at, implicitAccept],
    );
    // My own message means I've seen everything up to now.
    await client.query(
      `UPDATE messaging.members SET last_read_at = $3::timestamptz, notice_pending = false
        WHERE conversation_id = $1 AND user_id = $2`,
      [id, viewer.id, at],
    );
    const notice = await client.query(
      `UPDATE messaging.members SET notice_pending = true
        WHERE conversation_id = $1 AND user_id = $2 AND notice_pending = false
        RETURNING user_id`,
      [id, locked.otherId],
    );
    return { message, usage, implicitAccept, otherId: locked.otherId, notify: notice.rows.length > 0 };
  });

  if (outcome.implicitAccept) {
    await createNotification(outcome.otherId, {
      type: "success",
      title: "Request accepted",
      message: `${viewer.name} accepted your message request.`,
      href: conversationHref(id),
    });
  }
  if (outcome.notify) {
    await createNotification(outcome.otherId, {
      type: "info",
      title: "New message",
      message: `${viewer.name} sent you a message.`,
      href: conversationHref(id),
    });
  }
  return { message: mapMessage(outcome.message, viewer.id), usage: outcome.usage };
}

// ── Accept / decline / block / read / report ────────────────────────────────

export async function respondToConversation(viewer: Viewer, id: string, action: ConversationAction, now: number = Date.now()): Promise<Conversation> {
  await ensureMessagingSchema();
  const at = new Date(now).toISOString();
  const outcome = await withTransaction(async (client) => {
    const { locked } = await lockConversation(client, viewer.id, id, { allowHidden: action === "block" });
    const status = nextStatus(locked, viewer.id, action, locked.otherName);
    const changed = status !== locked.status;
    if (action === "block") {
      await client.query(
        `INSERT INTO messaging.blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
        [viewer.id, locked.otherId],
      );
      await client.query(
        `UPDATE messaging.conversations
            SET status = 'blocked', blocked_by = COALESCE(blocked_by, $2), blocked_at = COALESCE(blocked_at, $3::timestamptz)
          WHERE id = $1`,
        [id, viewer.id, at],
      );
    } else if (changed && status === "accepted") {
      await client.query(
        `UPDATE messaging.conversations SET status = 'accepted', accepted_at = $2::timestamptz, updated_at = $2::timestamptz WHERE id = $1`,
        [id, at],
      );
    } else if (changed && status === "declined") {
      await client.query(`UPDATE messaging.conversations SET status = 'declined', declined_at = $2::timestamptz WHERE id = $1`, [id, at]);
    }
    if (changed && action !== "block") {
      // Answering a request means the recipient has seen it.
      await client.query(
        `UPDATE messaging.members SET last_read_at = $3::timestamptz, notice_pending = false
          WHERE conversation_id = $1 AND user_id = $2`,
        [id, viewer.id, at],
      );
    }
    // Built for the blocker too: the response still describes the thread they just hid.
    const conversation = await client.query(
      `${VIEW_BASE_SQL} AND c.id = $2`,
      [viewer.id, id],
    );
    return { conversation: mapConversation(conversation.rows[0], viewer.id), accepted: changed && status === "accepted", otherId: locked.otherId };
  });
  if (outcome.accepted) {
    await createNotification(outcome.otherId, {
      type: "success",
      title: "Request accepted",
      message: `${viewer.name} accepted your message request.`,
      href: conversationHref(id),
    });
  }
  return outcome.conversation;
}

export async function markConversationRead(viewer: Viewer, id: string, now: number = Date.now()): Promise<void> {
  await ensureMessagingSchema();
  const p = pool();
  const conversation = await viewConversation(p, viewer.id, id);
  if (!conversation) throw notFound();
  await p.query(
    `INSERT INTO messaging.members (conversation_id, user_id, last_read_at, notice_pending)
     VALUES ($1, $2, $3::timestamptz, false)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET last_read_at = GREATEST(messaging.members.last_read_at, EXCLUDED.last_read_at), notice_pending = false`,
    [id, viewer.id, new Date(now).toISOString()],
  );
  // Best-effort: clear this conversation's unread notifications in the bell too.
  try {
    await p.query(`UPDATE app.notifications SET read = TRUE WHERE user_id = $1 AND href = $2 AND read = FALSE`, [
      viewer.id,
      conversationHref(id),
    ]);
  } catch {
    // app.notifications may not exist yet on a fresh database.
  }
}

export async function reportConversation(viewer: Viewer, id: string, reason: ReportReason, note: string | null): Promise<void> {
  await ensureMessagingSchema();
  const p = pool();
  // A blocker may still report the student they blocked.
  const row = await p.query(
    `SELECT CASE WHEN user_a = $2 THEN user_b ELSE user_a END AS other_id
       FROM messaging.conversations WHERE id = $1 AND (user_a = $2 OR user_b = $2)`,
    [id, viewer.id],
  );
  if (!row.rows[0]) throw notFound();
  const cleanNote = note?.replace(/\u0000/g, "").trim().slice(0, REPORT_NOTE_MAX_CHARS) || null;
  await p.query(
    `INSERT INTO messaging.reports (id, conversation_id, reporter_id, reported_id, reason, note)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [createPrefixedId("mrep"), id, viewer.id, String(row.rows[0].other_id), reason, cleanNote],
  );
}

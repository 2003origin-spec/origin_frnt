/**
 * Contest reminder fan-out (plan Phase 2b). For a contest + reminder-kind,
 * finds the registered users who have NOT yet received that reminder, sends it
 * across in-app + push + email, and records it in contest.reminders_sent so a
 * cron re-fire never double-notifies.
 *
 * Idempotency is claim-then-send: a row is INSERTed (ON CONFLICT DO NOTHING)
 * BEFORE sending, so two concurrent cron ticks can't both send the same
 * reminder — only the tick that wins the insert sends. Sending is best-effort
 * (a push/email provider blip never rolls back the claim; the user got at least
 * the in-app notification, and we don't retry a flaky channel forever).
 *
 * Batched (LIMIT per call) so a 1M-registrant contest is drained across many
 * cron ticks rather than one giant fan-out.
 */

import { createNotification } from "@/server/notifications";
import { sendPushToUser } from "@/server/push/fcm";
import { sendEmail } from "@/server/email";
import { sendWhatsapp } from "@/server/notifications/whatsapp";
import { getUserPostgresPool } from "@/server/user-postgres";

import { type ReminderKind, reminderCopy } from "@/lib/contest/reminders";
import { ensureContestSchema } from "./contest-schema";

const DEFAULT_BATCH = 500;

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

interface Recipient {
  userId: string;
  email: string | null;
  mobile?: string | null;
}

/**
 * Send `kind` to up to `limit` registered users of `contest` who haven't gotten
 * it yet. Returns how many were sent. Safe to call repeatedly (idempotent).
 */
export async function sendContestReminder(
  contestId: string,
  contestName: string,
  kind: ReminderKind,
  limit = DEFAULT_BATCH,
): Promise<number> {
  await ensureContestSchema();
  const p = pool();

  // Claim a batch: users registered for this contest with no reminders_sent row
  // for this kind. INSERT the claim rows first (idempotent), and only act on the
  // ones THIS call actually inserted (RETURNING) — that is the send-once lock.
  const claimed = await p.query<{ user_id: string; email: string | null; mobile: string | null }>(
    `WITH pending AS (
        SELECT r.user_id
          FROM contest.registrations r
          LEFT JOIN contest.reminders_sent s
            ON s.contest_id = r.contest_id AND s.user_id = r.user_id AND s.reminder_kind = $2
         WHERE r.contest_id = $1 AND s.user_id IS NULL
         LIMIT $3
      ), ins AS (
        INSERT INTO contest.reminders_sent (contest_id, user_id, reminder_kind)
        SELECT $1, user_id, $2 FROM pending
        ON CONFLICT (contest_id, user_id, reminder_kind) DO NOTHING
        RETURNING user_id
      )
      SELECT ins.user_id, u.email, u.mobile
        FROM ins JOIN origin_users u ON u.id = ins.user_id`,
    [contestId, kind, limit],
  );

  const recipients: Recipient[] = claimed.rows.map((r) => ({ userId: r.user_id, email: r.email, mobile: r.mobile }));
  if (recipients.length === 0) return 0;

  const copy = reminderCopy(kind, contestName);
  const href = `/contest/${contestId}`;

  // Fan out per recipient across the three channels. Each channel is
  // failure-isolated (its own no-op/try inside the sender), so one provider
  // being down never blocks the others or the batch.
  await Promise.allSettled(
    recipients.map(async (rec) => {
      await createNotification(rec.userId, {
        type: "info",
        title: copy.title,
        message: copy.body,
        href,
      }).catch(() => undefined);
      await sendPushToUser(rec.userId, { title: copy.title, body: copy.body, route: href }).catch(
        () => undefined,
      );
      if (rec.email) {
        await sendEmail({ to: rec.email, subject: copy.title, text: copy.body }).catch(() => undefined);
      }
      if (rec.mobile) {
        // WhatsApp channel — no-ops until WHATSAPP_API_* is configured (ships dark).
        await sendWhatsapp({ to: rec.mobile, body: `${copy.title}\n\n${copy.body}` }).catch(() => undefined);
      }
    }),
  );

  return recipients.length;
}

/**
 * Send the registration-confirmation reminder to a single user immediately
 * (called from the register action). Idempotent via the same ledger.
 */
export async function sendRegistrationConfirmation(
  contestId: string,
  contestName: string,
  userId: string,
): Promise<void> {
  await ensureContestSchema();
  const p = pool();
  const claimed = await p.query(
    `INSERT INTO contest.reminders_sent (contest_id, user_id, reminder_kind)
     VALUES ($1, $2, 'confirmation')
     ON CONFLICT (contest_id, user_id, reminder_kind) DO NOTHING
     RETURNING user_id`,
    [contestId, userId],
  );
  if (claimed.rowCount === 0) return; // already sent
  const copy = reminderCopy("confirmation", contestName);
  const href = `/contest/${contestId}`;
  await createNotification(userId, { type: "success", title: copy.title, message: copy.body, href }).catch(
    () => undefined,
  );
  await sendPushToUser(userId, { title: copy.title, body: copy.body, route: href }).catch(() => undefined);
}

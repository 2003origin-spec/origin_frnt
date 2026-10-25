/**
 * Coin gifts (decision B93): send bought or earned Ori Coins to another
 * Origin NOW member by their @username. Off until the `now_transfers`
 * setting is switched on (legal team). Rules in gift-rules.ts.
 */

import { createHash } from "node:crypto";

import { sendEmail } from "@/server/email";
import { paragraph, renderEmail } from "@/server/email/layout";
import { normalizeUsername } from "@/server/social/username";
import { getUserPostgresPool } from "@/server/user-postgres";

import { istDayStart } from "./admin-insights-service";
import { logEvent } from "./dispatch-service";
import { amountRefusal, giftLimit, senderRefusal, type GiftSenderFacts } from "./gift-rules";
import { computeGiftableCoins, userAccount, userTransfer } from "./ledger-rules";
import { loadLegs, postTransfers, withNowTransaction } from "./ledger-store";
import { ageInYears, getNowAccess } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { firstNameOnly } from "./session-rules";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type Exec = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };

async function senderFacts(exec: Exec, userId: string, now: Date): Promise<GiftSenderFacts> {
  const [user, helper, sent, legs] = await Promise.all([
    exec.query(`SELECT joined_at, date_of_birth FROM origin_users WHERE id = $1`, [userId]),
    exec.query(`SELECT 1 FROM now.helpers WHERE user_id = $1 AND kind = 'human' AND verification_status = 'verified'`, [userId]),
    exec.query(
      `SELECT COALESCE(sum(e.amount), 0)::int AS n FROM now.ledger_entries e JOIN now.ledger_transfers t ON t.id = e.transfer_id
        WHERE e.account_id = $1 AND e.direction = 'debit' AND t.kind = 'transfer' AND e.created_at >= $2`,
      [userAccount(userId), istDayStart(now)],
    ),
    loadLegs(exec as never, userAccount(userId)),
  ]);
  const row = user.rows[0] as { joined_at: Date | null; date_of_birth: Date | null } | undefined;
  return {
    accountAgeDays: row?.joined_at ? Math.floor((now.getTime() - row.joined_at.getTime()) / 86_400_000) : 0,
    isMinor: row?.date_of_birth ? ageInYears(row.date_of_birth, now) < 18 : null,
    verifiedSolver: helper.rows.length > 0,
    sentToday: Number((sent.rows[0] as { n: number }).n),
    giftable: computeGiftableCoins(legs, now),
  };
}

export type GiftOptions = {
  enabled: boolean;
  dailyCap: number;
  /** The most this person can send now (0 when they cannot). */
  limit: number;
  /** Why they cannot send, in plain words; null when they can. */
  blocked: string | null;
};

export async function getGiftOptions(userId: string, now: Date = new Date()): Promise<GiftOptions> {
  const { transfers } = await getNowSettings();
  if (!transfers.enabled) return { enabled: false, dailyCap: transfers.dailyCap, limit: 0, blocked: null };
  const facts = await senderFacts((await db()) as unknown as Exec, userId, now);
  const refusal = senderRefusal(transfers, facts);
  return { enabled: true, dailyCap: transfers.dailyCap, limit: refusal ? 0 : giftLimit(transfers, facts), blocked: refusal?.message ?? null };
}

/** Sends a gift. Safe to retry with the same Idempotency-Key (the second call posts nothing). */
export async function sendCoinGift(
  userId: string,
  input: { toUsername: string; amount: number },
  idempotencyKey: string,
  now: Date = new Date(),
): Promise<{ sent: number; toName: string }> {
  const { transfers } = await getNowSettings();
  if (!transfers.enabled) throw new NowError(404, "gifts_off", "Coin gifts are not switched on.");
  const access = await getNowAccess(userId, now);
  if (!access.inCohort && !access.helper) throw new NowError(403, "not_invited", "Origin NOW is not open for this account yet.");

  const pool = await db();
  const handle = normalizeUsername(input.toUsername.replace(/^@/, ""));
  // @usernames come from Student Social (its schema owns the column); without it nobody has one yet.
  const to = (
    await pool
      .query<{ id: string; name: string | null; email: string | null }>(`SELECT id, name, email FROM origin_users WHERE LOWER(username) = $1`, [handle])
      .catch((error: { code?: string }) => {
        if (error.code === "42703") return { rows: [] };
        throw error;
      })
  ).rows[0];
  if (!to) throw new NowError(404, "no_such_user", "No one has that username. Check it on their profile.");
  if (to.id === userId) throw new NowError(400, "self", "You cannot gift coins to yourself.");
  const toAccess = await getNowAccess(to.id, now);
  if (!toAccess.inCohort && !toAccess.helper) throw new NowError(409, "recipient_not_member", "They are not on Origin NOW yet, so coins would be no use to them.");
  const blocked = await pool.query(
    `SELECT 1 FROM now.blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
    [userId, to.id],
  );
  if (blocked.rows.length) throw new NowError(403, "blocked", "You cannot send coins to this person.");

  const giftId = `gift_${createHash("sha256").update(`${userId}:${idempotencyKey}`).digest("hex").slice(0, 24)}`;
  let posted = false;
  await withNowTransaction(async (client) => {
    // One gift at a time per sender, so the daily cap and the giftable coins cannot be overrun by two taps.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`now-gift:${userId}`]);
    const already = await client.query(`SELECT 1 FROM now.ledger_transfers WHERE idempotency_key = $1`, [`p2p:${giftId}`]);
    if (already.rows.length) return;
    const facts = await senderFacts(client as unknown as Exec, userId, now);
    const refusal = senderRefusal(transfers, facts) ?? amountRefusal(input.amount, giftLimit(transfers, facts));
    if (refusal) throw new NowError(409, refusal.code, refusal.message);
    await postTransfers([userTransfer(userId, to.id, input.amount, giftId)], { client, now, actorId: userId });
    await logEvent(client, { type: "wallet.gift", actor: userId, payload: { giftId, to: to.id, coins: input.amount } });
    posted = true;
  });

  if (posted && to.email) {
    const from = firstNameOnly((await pool.query<{ name: string | null }>(`SELECT name FROM origin_users WHERE id = $1`, [userId])).rows[0]?.name ?? null);
    const text = `${from} sent you ${input.amount} Ori Coins. They are in your Origin NOW wallet now.`;
    await sendEmail({
      to: to.email,
      subject: `${from} sent you ${input.amount} Ori Coins`,
      text,
      html: renderEmail({
        preheader: text,
        documentTitle: "Origin - Coin gift",
        mascot: "happy",
        title: "You got",
        titleAccent: `${input.amount} Ori Coins`,
        intro: [`${from} sent you a coin gift.`],
        blocks: [paragraph("Spend them on live help or in the Origin Store.", { align: "center" })],
        footerNote: "You received this because someone sent you Ori Coins on Origin.",
      }),
    }).catch(() => undefined);
  }
  return { sent: input.amount, toName: firstNameOnly(to.name) };
}

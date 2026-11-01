/**
 * Admin notification fan-out for money events that need a human look
 * (disputes, partial refunds, coupon overruns, duplicate captures).
 *
 * One `notification` outbox row per admin, enqueued INSIDE the caller's
 * transaction so the alert is as durable as the ledger change it describes.
 * Ids are `${idPrefix}_${adminId}`, which keeps the enqueue idempotent across
 * verify/webhook convergence. Callers publish the returned ids after COMMIT.
 */

import type { Pool, PoolClient } from "pg";

import { enqueueOutbox } from "./payments-store";

export type AdminAlertExecutor = Pick<Pool | PoolClient, "query">;

export type AdminAlertInput = {
  idPrefix: string;
  title: string;
  message: string;
  href?: string;
};

export async function enqueueAdminAlerts(
  client: AdminAlertExecutor,
  input: AdminAlertInput,
): Promise<string[]> {
  const admins = await client.query(`SELECT id FROM origin_users WHERE role = 'admin' ORDER BY id`);
  const ids: string[] = [];
  for (const row of admins.rows) {
    const adminId = String(row.id);
    const id = `${input.idPrefix}_${adminId}`;
    await enqueueOutbox(
      {
        id,
        kind: "notification",
        payload: {
          userId: adminId,
          notificationTitle: input.title,
          notificationMessage: input.message,
          href: input.href ?? "/admin/financials",
          type: "warning",
        },
      },
      client,
    );
    ids.push(id);
  }
  return ids;
}

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

import { createAuditEventId } from "./ids";
import { ensureWorkspaceSchema } from "./schema";
import type { AuditEventInput } from "./types";

/** Anything that can run the insert: the pool, or a transaction's client. */
export type AuditQueryable = { query(text: string, values?: unknown[]): Promise<unknown> };

/**
 * Writes one audit event. Pass `opts.client` (a client inside an open
 * transaction) to make the audit row part of that transaction: it then commits
 * or rolls back with the change it records. Without it the insert runs on its
 * own pool connection.
 */
export async function recordAuditEvent(
  input: AuditEventInput,
  opts: { client?: AuditQueryable } = {},
): Promise<void> {
  if (!opts.client && !isUserPostgresConfigured()) return;
  if (isUserPostgresConfigured()) await ensureWorkspaceSchema();
  const p: AuditQueryable | null = opts.client ?? getUserPostgresPool();
  if (!p) return;
  await p.query(
    `INSERT INTO app.audit_events (
       id, actor_user_id, workspace_id, entity_type, entity_id, action,
       before, after, request_id, ip_hash
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)`,
    [
      createAuditEventId(),
      input.actorUserId,
      input.workspaceId,
      input.entityType,
      input.entityId,
      input.action,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
      input.requestId ?? null,
      input.ipHash ?? null,
    ],
  );
}

/**
 * One-time backfill (idempotent): give every existing INSTITUTE workspace a
 * collaboration row so it appears in the admin approval queue
 * (/admin/collaborations).
 *
 * Why: before the approval gate, institute onboarding never created a
 * collaboration row — one was only created when a teacher explicitly hit the
 * "request collaboration" endpoint. So institutes that never requested (e.g.
 * tohin1400's coaching center) were structurally invisible to the admin panel,
 * which INNER JOINs app.origin_collaborations. This inserts a `pending` row for
 * each institute that lacks one, leaving already-approved/paused rows untouched.
 *
 * New rows are `pending` (NOT auto-approved): an admin still decides. Run once,
 * safe to re-run (ON CONFLICT (workspace_id) DO NOTHING + NOT EXISTS guard).
 *
 * Run:
 *   cd new-frontend
 *   node --env-file=/Users/xyx/Projects/Origin/.env scripts/backfill-pending-collaborations.mjs
 *
 * Reads USER_DATABASE_URL.
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";

const connectionString = process.env.USER_DATABASE_URL;
if (!connectionString) {
  console.error("USER_DATABASE_URL is not set. Run with --env-file=/Users/xyx/Projects/Origin/.env");
  process.exit(1);
}

/** Matches createPrefixedId("collab") in src/server/workspaces/ids.ts. */
function createCollaborationId() {
  return `collab_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

const c = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();

  // Every institute workspace with no collaboration row yet.
  const missing = await c.query(
    `SELECT w.id, w.display_name, w.owner_user_id
       FROM app.teacher_workspaces w
      WHERE w.workspace_type = 'institute'
        AND NOT EXISTS (
          SELECT 1 FROM app.origin_collaborations c WHERE c.workspace_id = w.id
        )
      ORDER BY w.created_at ASC`,
  );

  if (missing.rows.length === 0) {
    console.log("✓ no institute workspaces missing a collaboration row — nothing to backfill.");
  }

  let created = 0;
  for (const row of missing.rows) {
    const id = createCollaborationId();
    const res = await c.query(
      `INSERT INTO app.origin_collaborations (id, workspace_id, status, requested_by, metadata)
       VALUES ($1, $2, 'pending', $3, $4::jsonb)
       ON CONFLICT (workspace_id) DO NOTHING
       RETURNING id`,
      [id, row.id, row.owner_user_id ?? null, JSON.stringify({ source: "backfill_pending_collaborations" })],
    );
    if (res.rowCount > 0) {
      created += 1;
      console.log(`✓ pending collaboration created for: ${row.display_name} (${row.id})`);
    }
  }

  const summary = await c.query(
    `SELECT c.status, COUNT(*)::int AS n
       FROM app.origin_collaborations c
       INNER JOIN app.teacher_workspaces w ON w.id = c.workspace_id
      WHERE w.workspace_type = 'institute'
      GROUP BY c.status
      ORDER BY c.status`,
  );
  console.log(`\nBackfill complete — ${created} new pending row(s).`);
  console.log("Collaboration status counts:", JSON.stringify(summary.rows, null, 2));
  await c.end();
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

/**
 * Phase 2F go-live helper — seed ONE active collaboration so the student
 * "browse institutes" list is non-empty immediately.
 *
 * Safe-by-default: only auto-activates an institute workspace OWNED BY the tohin
 * teacher test account (user_teacher_tohin). If that account owns no institute it
 * just lists the available institute workspaces and seeds nothing (so a real
 * third-party institute is never marked a collaborator without intent).
 *
 *   cd new-frontend
 *   npx tsx --env-file=/Users/xyx/Projects/Origin/.env scripts/seed-connect-collaboration.ts
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureCollaborationSchema } from "@/server/connect/collaboration-schema";
import {
  setCollaborationStatus,
  upsertCollaborationRequest,
} from "@/server/connect/collaboration-store";

const TOHIN_TEACHER = "user_teacher_tohin";

/** Activate one institute workspace by id (looks up its owner + validates it). */
async function seedWorkspace(workspaceId: string): Promise<void> {
  const p = getUserPostgresPool()!;
  const r = await p.query<{ display_name: string; owner_user_id: string; status: string; workspace_type: string }>(
    `SELECT display_name, owner_user_id, status, workspace_type
       FROM app.teacher_workspaces WHERE id = $1`,
    [workspaceId],
  );
  const w = r.rows[0];
  if (!w) {
    console.log(`  ✗ ${workspaceId} — no such workspace, skipped`);
    return;
  }
  if (w.workspace_type !== "institute") {
    console.log(`  ✗ ${workspaceId} — not an institute (${w.workspace_type}), skipped`);
    return;
  }
  await upsertCollaborationRequest({ workspaceId, requestedBy: w.owner_user_id });
  const updated = await setCollaborationStatus(workspaceId, {
    status: "active",
    approvedBy: w.owner_user_id,
    flow1Enabled: true,
    flow2Enabled: true,
  });
  const note = w.status === "active" ? "" : ` (⚠ workspace status='${w.status}', not 'active' — flows stay dark until active)`;
  console.log(`  ✓ ${workspaceId} ("${w.display_name}") → collaboration ${updated?.status}${note}`);
}

async function main() {
  // Explicit workspace ids passed on the CLI → activate exactly those.
  const explicit = process.argv.slice(2).filter((a) => a.startsWith("ws_"));
  if (explicit.length > 0) {
    if (!isUserPostgresConfigured()) {
      console.error("USER_DATABASE_URL not set.");
      process.exit(1);
    }
    await ensureCollaborationSchema();
    console.log(`activating ${explicit.length} institute workspace(s):`);
    for (const id of explicit) await seedWorkspace(id);
    await getUserPostgresPool()!.end();
    process.exit(0);
  }
  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL not set.");
    process.exit(1);
  }
  await ensureCollaborationSchema();
  const p = getUserPostgresPool()!;

  const all = await p.query<{
    id: string;
    display_name: string;
    owner_user_id: string;
    status: string;
  }>(
    `SELECT id, display_name, owner_user_id, status
       FROM app.teacher_workspaces
      WHERE workspace_type = 'institute'
      ORDER BY (owner_user_id = $1) DESC, (status = 'active') DESC`,
    [TOHIN_TEACHER],
  );
  console.log(`institute workspaces (${all.rowCount}):`);
  for (const w of all.rows)
    console.log(`  ${w.id} | "${w.display_name}" | owner=${w.owner_user_id} | status=${w.status}`);

  const target =
    all.rows.find((w) => w.owner_user_id === TOHIN_TEACHER && w.status === "active") ??
    all.rows.find((w) => w.owner_user_id === TOHIN_TEACHER);

  if (!target) {
    console.log(
      "\nNo institute workspace owned by the tohin teacher account — seeding nothing.",
    );
    console.log(
      "Tell me which workspace id above to activate, or create one via teacher onboarding.",
    );
    await p.end();
    process.exit(0);
  }

  if (target.status !== "active") {
    console.log(
      `\n⚠ target workspace ${target.id} status is '${target.status}' (not 'active') — the ` +
        `collaboration row will be created but flows only light up once the workspace is active.`,
    );
  }

  await upsertCollaborationRequest({ workspaceId: target.id, requestedBy: target.owner_user_id });
  const updated = await setCollaborationStatus(target.id, {
    status: "active",
    approvedBy: target.owner_user_id,
    flow1Enabled: true,
    flow2Enabled: true,
  });
  console.log(`\n✓ seeded active collaboration for ${target.id} ("${target.display_name}")`);
  console.log("collaboration:", {
    status: updated?.status,
    flow1Enabled: updated?.flow1Enabled,
    flow2Enabled: updated?.flow2Enabled,
  });
  await p.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("[seed-connect-collaboration] failed", e);
  process.exit(1);
});

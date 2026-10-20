/**
 * Origin Notes — My Notes settings in app.platform_settings (V1/NOTES_PLAN.md §6).
 * Reads go through the platform-settings cache (about 30 s), so a change can
 * take that long to reach every server. Writes are audited.
 */

import {
  checkNotesSettings,
  NOTES_SETTING_KEYS,
  parseNotesSettings,
  serialiseNotesSettings,
  type NotesSettings,
} from "@/lib/notes/storage-rules";
import { getSetting, setSetting } from "@/server/platform-settings";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { NotesError } from "./notes-errors";

export async function getNotesSettings(): Promise<NotesSettings> {
  if (!isUserPostgresConfigured()) return parseNotesSettings({});
  const keys = Object.values(NOTES_SETTING_KEYS);
  const values = await Promise.all(keys.map((key) => getSetting(key)));
  return parseNotesSettings(Object.fromEntries(keys.map((key, i) => [key, values[i]])));
}

export async function updateNotesSettings(patch: Partial<NotesSettings>, actor: AdminActor): Promise<NotesSettings> {
  const before = await getNotesSettings();
  const next: NotesSettings = { ...before, ...patch, allowedKinds: patch.allowedKinds ?? before.allowedKinds };
  const problems = checkNotesSettings(next);
  if (problems.length > 0) throw new NotesError(400, "invalid_settings", problems.join(" "));
  const stored = serialiseNotesSettings(next);
  const old = serialiseNotesSettings(before);
  for (const [key, value] of Object.entries(stored)) {
    if (old[key] !== value) await setSetting(key, value, actor.userId);
  }
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_settings",
    entityId: "notes",
    action: "notes.settings.update",
    before,
    after: next,
  }).catch(() => undefined);
  return next;
}

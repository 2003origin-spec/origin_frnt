/**
 * Origin Notes — database helpers shared by every notes service.
 */

import type { PoolClient } from "pg";

import { createPrefixedId } from "@/server/workspaces/ids";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureNotesSchema } from "./notes-schema";
import { NotesError } from "./notes-errors";

export function notesPool() {
  const p = getUserPostgresPool();
  if (!p) throw new NotesError(503, "notes_unavailable", "Notes needs the database, which is not configured here.");
  return p;
}

/** Ensures the schema, then runs `fn` inside BEGIN/COMMIT (ROLLBACK on throw). */
export async function withNotesTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureNotesSchema();
  const client = await notesPool().connect();
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

/**
 * Bumps the library version inside an admin write. Student reads compare this
 * number with their cached tree and reload when it moved (library-tree.ts), so
 * a publish is visible on the very next request with no cache to clear.
 */
export async function bumpLibraryVersion(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO notes.library_state (id, version, updated_at) VALUES (TRUE, 1, now())
     ON CONFLICT (id) DO UPDATE SET version = notes.library_state.version + 1, updated_at = now()`,
  );
}

export const createNotesFolderId = () => createPrefixedId("nfold");
export const createNotesItemId = () => createPrefixedId("nitem");
export const createNotesRevisionId = () => createPrefixedId("nrev");
export const createNotesReportId = () => createPrefixedId("nrep");
export const createNotesUploadId = () => createPrefixedId("nupl");
export const createMyFolderId = () => createPrefixedId("nmfo");
export const createMyFileId = () => createPrefixedId("nmfi");

/** pg returns BIGINT as string; Notes byte counts always fit in a JS number. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value ?? "");
}

export function toIsoOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

/**
 * Origin Notes — importing note files written outside the app (V1/NOTES_PLAN.md §13).
 *
 * Each file is Markdown with a small header:
 *
 *   ---
 *   title: "Motion in a Plane: Formula Sheet"
 *   type: formula_sheet
 *   chapter: c11.physics.motion-in-a-plane     ← a standard folder's key
 *   key: c11.physics.motion-in-a-plane.formula-sheet   (optional)
 *   order: 1                                    (optional)
 *   ---
 *
 * Imports always land as DRAFTS. Re-importing the same key updates the draft
 * only when nobody has edited it in the app since the last import; an edited,
 * published or deleted note is reported as a conflict and left alone.
 */

import { createHash } from "node:crypto";

import { frontMatterString, parseFrontMatter } from "@/lib/notes/front-matter";
import { breadcrumbFor, cleanTitle, NOTES_BODY_MAX, slugify } from "@/lib/notes/rules";
import { NOTES_ACCESS_VALUES, NOTES_NOTE_TYPES, type NotesAccess, type NotesNoteType } from "@/lib/notes/types";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { getLibraryTree } from "./library-store";
import { analyseNoteMarkdown, type NoteIssue } from "./markdown-validate";
import { bumpLibraryVersion, createNotesItemId, createNotesRevisionId, notesPool, withNotesTransaction } from "./notes-db";
import { NotesError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";

export const IMPORT_MAX_FILES = 80;
export const IMPORT_MAX_TOTAL_CHARS = 3_500_000;

/** Default position of each note type inside a chapter folder. */
const TYPE_ORDER: Record<NotesNoteType, number> = {
  formula_sheet: 10,
  short_notes: 20,
  key_points: 30,
  practice: 40,
  other: 50,
};

export type ImportFile = { name: string; text: string };

export type ImportAction = "create" | "update" | "unchanged" | "conflict" | "error";

export type ImportFileResult = {
  name: string;
  key: string | null;
  title: string | null;
  noteType: NotesNoteType | null;
  folderPath: string | null;
  action: ImportAction;
  message: string | null;
  errors: NoteIssue[];
  warnings: NoteIssue[];
};

type Planned = ImportFileResult & {
  folderId?: string;
  body?: string;
  bodyText?: string;
  hash?: string;
  sortOrder?: number;
  access?: NotesAccess;
  existingId?: string;
};

function contentHash(title: string, noteType: string, body: string): string {
  return createHash("sha256").update(`${title}\n${noteType}\n${body.replace(/\r\n?/gu, "\n").trim()}`).digest("hex");
}

async function plan(files: ImportFile[]): Promise<Planned[]> {
  if (files.length === 0) throw new NotesError(400, "no_files", "Pick at least one .md file.");
  if (files.length > IMPORT_MAX_FILES) throw new NotesError(400, "too_many_files", `Import up to ${IMPORT_MAX_FILES} files at a time.`);
  const total = files.reduce((sum, file) => sum + file.text.length, 0);
  if (total > IMPORT_MAX_TOTAL_CHARS) throw new NotesError(413, "too_large", "These files are too big to import together. Import fewer at a time.");

  await ensureNotesSchema();
  const tree = await getLibraryTree();
  const folderByKey = new Map<string, string>();
  for (const node of Object.values(tree.nodes)) {
    if (node.syllabusKey) folderByKey.set(node.syllabusKey, node.id);
  }

  const planned: Planned[] = files.map((file) => {
    const base: Planned = {
      name: file.name,
      key: null,
      title: null,
      noteType: null,
      folderPath: null,
      action: "error",
      message: null,
      errors: [],
      warnings: [],
    };
    const header = parseFrontMatter(file.text);
    base.errors.push(...header.errors.map((message) => ({ line: 1, message })));

    const title = cleanTitle(frontMatterString(header.data, "title"));
    if (title.ok) base.title = title.title;
    else base.errors.push({ line: 1, message: `Header "title": ${title.error}` });

    const type = frontMatterString(header.data, "type");
    if (type && (NOTES_NOTE_TYPES as readonly string[]).includes(type)) base.noteType = type as NotesNoteType;
    else base.errors.push({ line: 1, message: `Header "type" must be one of: ${NOTES_NOTE_TYPES.join(", ")}.` });

    const chapter = frontMatterString(header.data, "chapter");
    const folderId = chapter ? folderByKey.get(chapter) : undefined;
    if (!chapter) base.errors.push({ line: 1, message: 'Header "chapter" is missing (e.g. c11.physics.motion-in-a-plane).' });
    else if (!folderId) base.errors.push({ line: 1, message: `No folder has the key "${chapter}". Run "Create standard folders" first.` });
    else {
      base.folderId = folderId;
      base.folderPath = breadcrumbFor(tree, folderId).map((crumb) => crumb.name).join(" › ");
    }

    const explicitKey = frontMatterString(header.data, "key");
    base.key = explicitKey ?? (chapter && base.noteType ? `${chapter}.${slugify(base.noteType)}` : null);
    if (base.key && !/^[a-z0-9][a-z0-9._-]{2,190}$/u.test(base.key)) {
      base.errors.push({ line: 1, message: 'Header "key" may only use lower-case letters, numbers, dots and dashes.' });
    }

    const access = frontMatterString(header.data, "access");
    if (access && !(NOTES_ACCESS_VALUES as readonly string[]).includes(access)) {
      base.errors.push({ line: 1, message: 'Header "access" must be free, premium or inherit.' });
    }
    base.access = (access as NotesAccess | null) ?? "inherit";

    const order = frontMatterString(header.data, "order");
    const orderNumber = order === null ? null : Number(order);
    if (order !== null && (!Number.isInteger(orderNumber) || (orderNumber ?? 0) < 0 || (orderNumber ?? 0) > 1000)) {
      base.errors.push({ line: 1, message: 'Header "order" must be a whole number.' });
    }
    base.sortOrder = orderNumber !== null && Number.isInteger(orderNumber) ? orderNumber * 10 : base.noteType ? TYPE_ORDER[base.noteType] : 50;

    const body = header.body.replace(/\r\n?/gu, "\n");
    if (!body.trim()) base.errors.push({ line: header.bodyLine, message: "The note has no text after the header." });
    if (body.length > NOTES_BODY_MAX) base.errors.push({ line: header.bodyLine, message: "The note is too long. Split it into two files." });
    if (body.trim() && body.length <= NOTES_BODY_MAX) {
      const analysis = analyseNoteMarkdown(body, header.bodyLine - 1);
      base.errors.push(...analysis.errors);
      base.warnings.push(...analysis.warnings);
      base.bodyText = analysis.plainText;
    }
    base.body = body;
    if (base.title && base.noteType) base.hash = contentHash(base.title, base.noteType, body);
    return base;
  });

  // Duplicate keys inside one batch.
  const seen = new Map<string, string>();
  for (const entry of planned) {
    if (!entry.key) continue;
    const first = seen.get(entry.key);
    if (first) entry.errors.push({ line: 1, message: `Same key as "${first}". Give one of them its own "key".` });
    else seen.set(entry.key, entry.name);
  }

  const keys = planned.filter((entry) => entry.key && entry.errors.length === 0).map((entry) => entry.key as string);
  const existing = keys.length
    ? await notesPool().query(
        `SELECT id, external_key, title, note_type, body_md, import_hash, status, deleted_at
           FROM notes.items WHERE external_key = ANY($1::text[])`,
        [keys],
      )
    : { rows: [] as Record<string, unknown>[] };
  const byKey = new Map(existing.rows.map((row) => [String(row.external_key), row]));

  for (const entry of planned) {
    if (entry.errors.length > 0) {
      entry.action = "error";
      entry.message = `${entry.errors.length} problem${entry.errors.length === 1 ? "" : "s"} to fix`;
      continue;
    }
    const row = byKey.get(entry.key as string);
    if (!row) {
      entry.action = "create";
      continue;
    }
    entry.existingId = String(row.id);
    const currentHash = contentHash(String(row.title), String(row.note_type), String(row.body_md ?? ""));
    if (row.deleted_at) {
      entry.action = "conflict";
      entry.message = "This note is in the Bin. Restore it first if you want to update it.";
    } else if (currentHash === entry.hash) {
      entry.action = "unchanged";
    } else if (row.status === "published") {
      entry.action = "conflict";
      entry.message = "This note is live. Edit it in the app, or unpublish it before re-importing.";
    } else if (row.import_hash && row.import_hash !== currentHash) {
      entry.action = "conflict";
      entry.message = "Someone edited this note in the app since it was imported. Their edits were kept.";
    } else {
      entry.action = "update";
    }
  }
  return planned;
}

function publicResult(entry: Planned): ImportFileResult {
  return {
    name: entry.name,
    key: entry.key,
    title: entry.title,
    noteType: entry.noteType,
    folderPath: entry.folderPath,
    action: entry.action,
    message: entry.message,
    errors: entry.errors,
    warnings: entry.warnings,
  };
}

export async function previewImport(files: ImportFile[]): Promise<ImportFileResult[]> {
  return (await plan(files)).map(publicResult);
}

export async function applyImport(files: ImportFile[], actor: AdminActor): Promise<ImportFileResult[]> {
  const planned = await plan(files);
  const work = planned.filter((entry) => entry.action === "create" || entry.action === "update");
  if (work.length > 0) {
    await withNotesTransaction(async (client) => {
      for (const entry of work) {
        if (entry.action === "create") {
          const id = createNotesItemId();
          await client.query(
            `INSERT INTO notes.items (id, folder_id, kind, note_type, title, body_md, body_text, access, status, source,
                                      external_key, import_hash, sort_order, created_by, updated_by)
             VALUES ($1, $2, 'typed', $3, $4, $5, $6, $7, 'draft', 'import', $8, $9, $10, $11, $11)`,
            [id, entry.folderId, entry.noteType, entry.title, entry.body, entry.bodyText ?? "", entry.access, entry.key, entry.hash, entry.sortOrder, actor.userId],
          );
          await client.query(
            `INSERT INTO notes.item_revisions (id, item_id, version, title, body_md, edited_by) VALUES ($1, $2, 1, $3, $4, $5)`,
            [createNotesRevisionId(), id, entry.title, entry.body, actor.userId],
          );
          entry.existingId = id;
        } else {
          const updated = await client.query(
            `UPDATE notes.items
                SET folder_id = $2, note_type = $3, title = $4, body_md = $5, body_text = $6, access = $7,
                    import_hash = $8, version = version + 1, updated_by = $9, updated_at = now()
              WHERE id = $1 AND deleted_at IS NULL AND status <> 'published'
              RETURNING version`,
            [entry.existingId, entry.folderId, entry.noteType, entry.title, entry.body, entry.bodyText ?? "", entry.access, entry.hash, actor.userId],
          );
          if (!updated.rows[0]) {
            entry.action = "conflict";
            entry.message = "This note changed while importing. Run the import again.";
            continue;
          }
          await client.query(
            `INSERT INTO notes.item_revisions (id, item_id, version, title, body_md, edited_by)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (item_id, version) DO NOTHING`,
            [createNotesRevisionId(), entry.existingId, updated.rows[0].version, entry.title, entry.body, actor.userId],
          );
        }
      }
      await bumpLibraryVersion(client);
    });
  }
  const results = planned.map(publicResult);
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_item",
    entityId: "import",
    action: "notes.item.import",
    after: {
      created: results.filter((r) => r.action === "create").length,
      updated: results.filter((r) => r.action === "update").length,
      keys: work.map((entry) => entry.key),
    },
  }).catch(() => undefined);
  return results;
}

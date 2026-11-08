/**
 * Import Origin Notes Markdown files into a LOCAL or dev database
 * (V1/NOTES_PLAN.md §13). Production imports go through Admin → Notes →
 * Import, so no database password ever has to be shared.
 *
 *   USER_DATABASE_URL=… OGCODE_DATABASE_URL=… npm run notes:import -- [options] [paths…]
 *
 *   (no option)       preview only: what would be created / updated / skipped, and every error
 *   --apply           import as drafts
 *   --as <userId>     the admin recorded as the importer (default: the main admin, else any admin)
 *   --publish-local   after importing, publish the notes and their folders so the student view
 *                     can be checked — LOCAL databases only; the reviewer is recorded as
 *                     "Local preview only (not reviewed)". Notes this flag published earlier are
 *                     unpublished first, so changed files can be re-imported in one go.
 *   --allow-remote    allow a non-local database (preview/apply only; never --publish-local)
 *
 * Default path: data/notes. README.md files are skipped. Exits 1 when any file has errors.
 * The standard folders must exist first (Admin → Notes → "Create standard folders").
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { setItemStatus, updateFolder } from "@/server/notes/library-admin";
import { applyImport, previewImport, type ImportFileResult } from "@/server/notes/library-import";
import { getItemRow } from "@/server/notes/library-store";
import { notesPool } from "@/server/notes/notes-db";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_REVIEWER = "Local preview only (not reviewed)";

function collect(path: string, out: string[]): void {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path).sort()) collect(join(path, entry), out);
  } else if (path.endsWith(".md") && basename(path).toLowerCase() !== "readme.md") {
    out.push(path);
  }
}

function databaseIsLocal(): boolean {
  const raw = process.env.USER_DATABASE_URL;
  if (!raw) throw new Error("Set USER_DATABASE_URL (and OGCODE_DATABASE_URL) to the database to import into.");
  return LOCAL_HOSTS.has(new URL(raw).hostname);
}

function print(results: ImportFileResult[], files: Map<string, string>): number {
  let errors = 0;
  for (const result of results) {
    const label = result.action.toUpperCase().padEnd(9);
    console.log(`${label} ${result.key ?? "(no key)"} — ${result.title ?? result.name}${result.folderPath ? `  →  ${result.folderPath}` : ""}`);
    if (result.message) console.log(`          ${result.message}`);
    const where = files.get(result.name) ?? result.name;
    for (const issue of result.errors) {
      errors += 1;
      console.log(`  error   ${where}${issue.line ? `:${issue.line}` : ""}  ${issue.message}`);
    }
    for (const issue of result.warnings) console.log(`  warning ${where}${issue.line ? `:${issue.line}` : ""}  ${issue.message}`);
  }
  const count = (action: ImportFileResult["action"]) => results.filter((r) => r.action === action).length;
  console.log(
    `\n${results.length} files: ${count("create")} new, ${count("update")} update, ${count("unchanged")} unchanged, ` +
      `${count("conflict")} skipped, ${count("error")} with errors`,
  );
  return errors;
}

async function adminId(explicit: string | null): Promise<string> {
  if (explicit) return explicit;
  const result = await notesPool().query(
    `SELECT id FROM origin_users WHERE role = 'admin' ORDER BY is_main_admin DESC NULLS LAST, joined_at ASC NULLS LAST LIMIT 1`,
  );
  if (!result.rows[0]) throw new Error("No admin user found. Pass --as <adminUserId>.");
  return String(result.rows[0].id);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => args.includes(name);
  const asIndex = args.indexOf("--as");
  const asUser = asIndex !== -1 ? (args[asIndex + 1] ?? null) : null;
  const paths = args.filter((arg, i) => !arg.startsWith("--") && args[i - 1] !== "--as");
  const local = databaseIsLocal();
  if (!local && !flag("--allow-remote")) {
    throw new Error("USER_DATABASE_URL is not a local database. Use Admin → Notes → Import for production, or pass --allow-remote.");
  }
  if (flag("--publish-local") && !local) throw new Error("--publish-local only works on a local database.");

  const files: string[] = [];
  for (const path of paths.length ? paths : ["data/notes"]) collect(path, files);
  if (files.length === 0) throw new Error("No .md note files found.");
  const byName = new Map<string, string>();
  const batch = files.map((file) => {
    const name = relative("data/notes", file).startsWith("..") ? file : relative("data/notes", file);
    byName.set(name, file);
    return { name, text: readFileSync(file, "utf8") };
  });

  let preview = await previewImport(batch);
  const actor = flag("--apply") ? { userId: await adminId(asUser) } : null;
  if (actor && flag("--publish-local")) {
    // Live notes block a re-import. On a local database, take back the ones this
    // flag published (never a note someone reviewed), then plan again.
    const live = preview.filter((r) => r.action === "conflict" && r.key).map((r) => r.key as string);
    const ours = live.length
      ? await notesPool().query(
          `SELECT id FROM notes.items
            WHERE external_key = ANY($1::text[]) AND status = 'published' AND reviewer_name = $2 AND deleted_at IS NULL`,
          [live, LOCAL_REVIEWER],
        )
      : { rows: [] as Record<string, unknown>[] };
    for (const row of ours.rows) await setItemStatus(String(row.id), "draft", null, actor);
    if (ours.rows.length > 0) {
      console.log(`Unpublished ${ours.rows.length} local preview notes so they can be updated.\n`);
      preview = await previewImport(batch);
    }
  }
  console.log(flag("--apply") ? "Checking before import…\n" : "Preview (nothing is written; add --apply to import)\n");
  const errors = print(preview, byName);
  if (errors > 0) {
    process.exitCode = 1;
    if (flag("--apply")) console.log("\nNothing imported: fix the errors first.");
    return;
  }
  if (!actor) return;

  const applied = await applyImport(batch, actor);
  console.log("\nImported as drafts:");
  print(applied, byName);

  if (flag("--publish-local")) {
    const keys = applied.filter((r) => r.action !== "error" && r.action !== "conflict" && r.key).map((r) => r.key as string);
    const rows = await notesPool().query(`SELECT id FROM notes.items WHERE external_key = ANY($1::text[]) AND deleted_at IS NULL`, [keys]);
    const folders = new Set<string>();
    for (const row of rows.rows) {
      const item = await setItemStatus(String(row.id), "published", LOCAL_REVIEWER, actor);
      folders.add(item.folderId);
    }
    for (const folderId of folders) await updateFolder(folderId, { status: "published", publishParents: true }, actor);
    console.log(`\nPublished ${rows.rows.length} notes in ${folders.size} chapter folders (local preview only).`);
    const sample = rows.rows[0] ? await getItemRow(String(rows.rows[0].id)) : null;
    if (sample) console.log(`Open one at /notes?n=${sample.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await notesPool().end().catch(() => undefined);
  });

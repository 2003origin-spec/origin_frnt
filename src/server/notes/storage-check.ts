/**
 * Origin Notes — Phase 0 storage self-check (V1/NOTES_PLAN.md §12, Phase 0).
 *
 * Proves, against the real private bucket, every storage call Notes relies on:
 * signed PUT/HEAD/ranged GET/COPY/DELETE from the server, presigned GET and
 * PUT links (including that a PUT with the wrong Content-Type is refused), and
 * — from the admin's own browser — that the bucket's CORS rules allow uploads
 * and pdf.js reads. Admin-only; every object it writes lives under
 * `notes/checks/` and is deleted before it returns.
 */

import { randomUUID } from "node:crypto";

import { NotesError } from "./notes-errors";
import {
  copyNotesObject,
  deleteNotesObject,
  headNotesObject,
  isNotesStorageConfigured,
  NotesObjectChangedError,
  presignNotesGet,
  presignNotesPut,
  putNotesObject,
  readNotesObjectStart,
} from "./notes-storage";

export type CheckStep = { name: string; ok: boolean; ms: number; detail: string };

async function step(steps: CheckStep[], name: string, run: () => Promise<string>): Promise<boolean> {
  const started = Date.now();
  try {
    const detail = await run();
    steps.push({ name, ok: true, ms: Date.now() - started, detail });
    return true;
  } catch (error) {
    steps.push({ name, ok: false, ms: Date.now() - started, detail: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function runServerStorageCheck(): Promise<{ ok: boolean; steps: CheckStep[] }> {
  const steps: CheckStep[] = [];
  if (!isNotesStorageConfigured()) {
    steps.push({
      name: "Settings",
      ok: false,
      ms: 0,
      detail: "R2_NOTES_BUCKET and the R2 keys are not all set, so nothing else can be checked.",
    });
    return { ok: false, steps };
  }
  const id = randomUUID();
  const key = `notes/checks/${id}.txt`;
  const copyKey = `notes/checks/${id}-copy.txt`;
  const linkKey = `notes/checks/${id}-link.txt`;
  const body = Buffer.from(`origin-notes-check ${new Date().toISOString()}`);

  try {
    if (!(await step(steps, "Server upload", async () => {
      await putNotesObject(key, body, "text/plain");
      return `${body.length} bytes written`;
    }))) return { ok: false, steps };

    await step(steps, "Read size (HEAD)", async () => {
      const info = await headNotesObject(key);
      if (!info) throw new Error("object not found right after upload");
      if (info.bytes !== body.length) throw new Error(`size ${info.bytes}, expected ${body.length}`);
      return `${info.bytes} bytes, ${info.contentType ?? "no type"}`;
    });

    let etag: string | null = null;
    await step(steps, "Read first bytes", async () => {
      etag = (await headNotesObject(key))?.etag ?? null;
      const head = await readNotesObjectStart(key, 18, etag);
      const text = Buffer.from(head).toString("utf8");
      if (text !== "origin-notes-check") throw new Error(`got "${text}"`);
      return "first 18 bytes match";
    });

    await step(steps, "Copy inside the bucket", async () => {
      await copyNotesObject(key, copyKey, etag);
      const info = await headNotesObject(copyKey);
      if (!info || info.bytes !== body.length) throw new Error("copy missing or wrong size");
      return "copy has the same size";
    });

    await step(steps, "Copy refuses a changed file", async () => {
      try {
        await copyNotesObject(key, copyKey, '"0000000000000000000000000000000f"');
      } catch (error) {
        if (error instanceof NotesObjectChangedError) return "refused (the ETag check works)";
        throw error;
      }
      throw new Error("R2 copied although the ETag did not match");
    });

    await step(steps, "Signed download link", async () => {
      const url = presignNotesGet(key, { contentType: "text/plain", fileName: "check.txt", expiresSeconds: 60 });
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text !== body.toString("utf8")) throw new Error("content differs");
      return `HTTP ${response.status}, type ${response.headers.get("content-type") ?? "?"}`;
    });

    await step(steps, "Signed upload link", async () => {
      const url = presignNotesPut(linkKey, "text/plain", "link-upload".length, 60);
      const response = await fetch(url, { method: "PUT", body: "link-upload", headers: { "Content-Type": "text/plain" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const info = await headNotesObject(linkKey);
      if (!info) throw new Error("uploaded object not found");
      return "upload through the link worked";
    });

    await step(steps, "Upload link refuses another file type", async () => {
      const url = presignNotesPut(linkKey, "text/plain", "%PDF-sneaky".length, 60);
      const response = await fetch(url, { method: "PUT", body: "%PDF-sneaky", headers: { "Content-Type": "application/pdf" } });
      if (response.ok) throw new Error("R2 accepted a PUT whose Content-Type differs from the signed one");
      return `refused with HTTP ${response.status}`;
    });

    await step(steps, "Upload link refuses another file size", async () => {
      const url = presignNotesPut(linkKey, "text/plain", 5, 60);
      const response = await fetch(url, { method: "PUT", body: "a much bigger body than signed", headers: { "Content-Type": "text/plain" } });
      if (response.ok) throw new Error("R2 accepted a PUT whose size differs from the signed one");
      return `refused with HTTP ${response.status}`;
    });
  } finally {
    await step(steps, "Clean up", async () => {
      await Promise.all([deleteNotesObject(key), deleteNotesObject(copyKey), deleteNotesObject(linkKey)]);
      const gone = await headNotesObject(key);
      if (gone) throw new Error("test object still there after delete");
      return "all test objects deleted";
    });
  }
  return { ok: steps.every((s) => s.ok), steps };
}

const BROWSER_KEY = /^notes\/checks\/[0-9a-f-]{36}-browser\.txt$/u;
const BROWSER_CHECK_BODY = "origin-notes-browser-check";

/** Links for the in-browser CORS check (upload, then read back). */
export function createBrowserCheck(): { checkKey: string; putUrl: string; getUrl: string } {
  if (!isNotesStorageConfigured()) {
    throw new NotesError(503, "storage_not_configured", "R2_NOTES_BUCKET and the R2 keys are not all set yet.");
  }
  const checkKey = `notes/checks/${randomUUID()}-browser.txt`;
  return {
    checkKey,
    // Must match the body ChecksPanel sends ("origin-notes-browser-check").
    putUrl: presignNotesPut(checkKey, "text/plain", BROWSER_CHECK_BODY.length, 300),
    getUrl: presignNotesGet(checkKey, { contentType: "text/plain", fileName: "check.txt", expiresSeconds: 300 }),
  };
}

/** Confirms the browser's upload arrived, then deletes it. */
export async function finishBrowserCheck(checkKey: string): Promise<{ arrived: boolean; bytes: number }> {
  if (!BROWSER_KEY.test(checkKey)) throw new NotesError(400, "invalid_key", "Unknown check.");
  const info = await headNotesObject(checkKey);
  await deleteNotesObject(checkKey).catch(() => undefined);
  return { arrived: Boolean(info), bytes: info?.bytes ?? 0 };
}

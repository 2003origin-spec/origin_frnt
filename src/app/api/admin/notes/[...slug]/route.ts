import type { NextRequest } from "next/server";
import { z } from "zod";

import { checkRateLimit, notesUploadLimiter } from "@/lib/rate-limit";
import {
  NOTES_ACCESS_VALUES,
  NOTES_EXAMS,
  NOTES_FOLDER_KINDS,
  NOTES_FOLDER_STATUSES,
  NOTES_ITEM_STATUSES,
  NOTES_NOTE_TYPES,
  NOTES_SUBJECTS,
} from "@/lib/notes/types";
import { requireAdmin, type AuthContext } from "@/server/authz";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { listOgcodeCatalogFacets } from "@/server/ogcode-catalog";
import {
  createFolder,
  createTypedNote,
  deleteFolder,
  deleteItem,
  getAdminFolderView,
  getAdminItem,
  getAdminItemFileUrl,
  getAdminTree,
  getRevisionBody,
  listBin,
  listRevisions,
  moveFolder,
  moveItem,
  reorder,
  restoreFromBin,
  restoreRevision,
  setItemStatus,
  updateFolder,
  updateItem,
} from "@/server/notes/library-admin";
import { applyImport, IMPORT_MAX_FILES, previewImport } from "@/server/notes/library-import";
import { assertReportStatus, getCoverage, listReports, resolveReport } from "@/server/notes/library-reports";
import { listSharedReports, openReportedFile, removeReportedFile } from "@/server/notes/my-shares-admin";
import { createStandardFolders } from "@/server/notes/library-skeleton";
import { completeLibraryUpload, createLibraryUpload, uploadNoteDiagram } from "@/server/notes/library-uploads";
import { notesErrorResponse } from "@/server/notes/notes-errors";
import { findRoute, type NotesRoute } from "@/server/notes/notes-routes";
import { createBrowserCheck, finishBrowserCheck, runServerStorageCheck } from "@/server/notes/storage-check";
import { findStorageUsers, getStorageOverview, getStorageUser, updateStorageUser } from "@/server/notes/my-admin";
import { getNotesSettings, updateNotesSettings } from "@/server/notes/my-settings";
import { PERSONAL_UPLOAD_KINDS } from "@/lib/notes/storage-rules";

/**
 * Origin Notes — admin API (V1/NOTES_PLAN.md §4, §7). One catch-all on purpose
 * (Next 16 new-route-404 rule, new-frontend/AGENTS.md). Covered at the edge by
 * the "/api/admin" authenticated prefix; `requireAdmin` here. Every change is
 * written to app.audit_events by the services it calls.
 *
 * NOT behind the `notes` flag: admins build and review the library before
 * students can see it.
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };
type Ctx = { request: NextRequest; params: Record<string, string>; auth: AuthContext };
type Handler = (ctx: Ctx) => Promise<Response>;

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function body<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.infer<T>> {
  return schema.parse(await parseJsonBody(request));
}

const id = z.string().trim().min(1).max(120);
const classLevel = z.number().int().min(9).max(12).nullable();
const subject = z.enum(NOTES_SUBJECTS).nullable();
const ncertNumber = z.number().int().min(1).max(40).nullable();

const createFolderSchema = z.object({
  parentId: id.nullable(),
  name: z.string().max(200),
  kind: z.enum(NOTES_FOLDER_KINDS).optional(),
  classLevel: classLevel.optional(),
  subject: subject.optional(),
  ncertNumber: ncertNumber.optional(),
  access: z.enum(NOTES_ACCESS_VALUES).optional(),
});

const updateFolderSchema = z.object({
  name: z.string().max(200).optional(),
  access: z.enum(NOTES_ACCESS_VALUES).optional(),
  status: z.enum(NOTES_FOLDER_STATUSES).optional(),
  bankChapters: z.array(z.string().max(200)).max(6).optional(),
  exams: z.array(z.enum(NOTES_EXAMS)).max(3).optional(),
  classLevel: classLevel.optional(),
  subject: subject.optional(),
  ncertNumber: ncertNumber.optional(),
  kind: z.enum(NOTES_FOLDER_KINDS).optional(),
  publishParents: z.boolean().optional(),
});

const createNoteSchema = z.object({
  folderId: id,
  title: z.string().max(300),
  noteType: z.enum(NOTES_NOTE_TYPES),
  bodyMd: z.string().max(210_000),
  access: z.enum(NOTES_ACCESS_VALUES).optional(),
});

const updateItemSchema = z.object({
  baseVersion: z.number().int().min(1),
  title: z.string().max(300).optional(),
  noteType: z.enum(NOTES_NOTE_TYPES).optional(),
  bodyMd: z.string().max(210_000).optional(),
  access: z.enum(NOTES_ACCESS_VALUES).optional(),
});

const byteCount = z.number().int().min(0);

const settingsSchema = z.object({
  freeLimitBytes: byteCount.optional(),
  premiumLimitBytes: byteCount.optional(),
  maxFileBytes: byteCount.optional(),
  maxVideoBytes: byteCount.optional(),
  allowedKinds: z.array(z.enum(PERSONAL_UPLOAD_KINDS as unknown as [string, ...string[]])).max(5).optional(),
  uploadsEnabled: z.boolean().optional(),
  sharingEnabled: z.boolean().optional(),
  binDays: z.number().int().optional(),
});

const storageUserSchema = z.object({
  limitOverrideBytes: byteCount.max(50 * 1024 * 1024 * 1024).nullable().optional(),
  overrideReason: z.string().max(500).nullable().optional(),
  uploadsBlocked: z.boolean().optional(),
  sharingBlocked: z.boolean().optional(),
  blockReason: z.string().max(500).nullable().optional(),
});

const importSchema = z.object({
  files: z
    .array(z.object({ name: z.string().max(200), text: z.string().max(210_000) }))
    .min(1)
    .max(IMPORT_MAX_FILES),
});

const ROUTES: NotesRoute<Handler>[] = [
  // ── Tree and folders ──
  { method: "GET", pattern: ["tree"], handler: async () => json(await getAdminTree()) },
  {
    method: "GET",
    pattern: ["folders", ":id"],
    handler: async ({ params }) => json(await getAdminFolderView(params.id === "root" ? null : params.id)),
  },
  {
    method: "POST",
    pattern: ["folders"],
    handler: async ({ request, auth }) => json({ folder: await createFolder(await body(request, createFolderSchema), auth) }, 201),
  },
  {
    method: "PUT",
    pattern: ["folders", ":id"],
    handler: async ({ request, params, auth }) => json({ folder: await updateFolder(params.id, await body(request, updateFolderSchema), auth) }),
  },
  {
    method: "POST",
    pattern: ["folders", ":id", "move"],
    handler: async ({ request, params, auth }) => {
      const { parentId } = await body(request, z.object({ parentId: id.nullable() }));
      return json({ folder: await moveFolder(params.id, parentId, auth) });
    },
  },
  {
    method: "DELETE",
    pattern: ["folders", ":id"],
    handler: async ({ params, auth }) => json({ moved: await deleteFolder(params.id, auth) }),
  },
  {
    method: "POST",
    pattern: ["reorder"],
    handler: async ({ request, auth }) => {
      const input = await body(
        request,
        z.object({ kind: z.enum(["folders", "items"]), parentId: id.nullable(), orderedIds: z.array(id).min(1).max(500) }),
      );
      await reorder(input.kind, input.parentId, input.orderedIds, auth);
      return json({ ok: true });
    },
  },
  { method: "GET", pattern: ["bin"], handler: async () => json({ entries: await listBin() }) },
  {
    method: "POST",
    pattern: ["bin", ":type", ":id", "restore"],
    handler: async ({ params, auth }) => {
      const type = z.enum(["folder", "item"]).parse(params.type);
      await restoreFromBin(type, params.id, auth);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["standard-folders"],
    handler: async ({ request, auth }) => {
      const input = await body(request, z.object({ classLevels: z.array(z.number().int().min(9).max(12)).max(4).optional() }));
      return json(await createStandardFolders(auth, input.classLevels));
    },
  },
  // ── Items ──
  {
    method: "POST",
    pattern: ["items"],
    handler: async ({ request, auth }) => json({ item: await createTypedNote(await body(request, createNoteSchema), auth) }, 201),
  },
  { method: "GET", pattern: ["items", ":id"], handler: async ({ params }) => json(await getAdminItem(params.id)) },
  {
    method: "PUT",
    pattern: ["items", ":id"],
    handler: async ({ request, params, auth }) => json({ item: await updateItem(params.id, await body(request, updateItemSchema), auth) }),
  },
  {
    method: "POST",
    pattern: ["items", ":id", "status"],
    handler: async ({ request, params, auth }) => {
      const input = await body(request, z.object({ status: z.enum(NOTES_ITEM_STATUSES), reviewerName: z.string().max(120).optional().nullable() }));
      return json({ item: await setItemStatus(params.id, input.status, input.reviewerName ?? null, auth) });
    },
  },
  {
    method: "POST",
    pattern: ["items", ":id", "move"],
    handler: async ({ request, params, auth }) => {
      const { folderId } = await body(request, z.object({ folderId: id }));
      return json({ item: await moveItem(params.id, folderId, auth) });
    },
  },
  {
    method: "DELETE",
    pattern: ["items", ":id"],
    handler: async ({ params, auth }) => {
      await deleteItem(params.id, auth);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["items", ":id", "file"],
    handler: async ({ request, params }) => {
      const url = await getAdminItemFileUrl(params.id);
      // JSON for pdf.js (see the student route for why it must not follow a redirect).
      if (request.nextUrl.searchParams.get("format") === "json") return json({ url });
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
    },
  },
  { method: "GET", pattern: ["items", ":id", "revisions"], handler: async ({ params }) => json({ revisions: await listRevisions(params.id) }) },
  {
    method: "GET",
    pattern: ["items", ":id", "revisions", ":revisionId"],
    handler: async ({ params }) => json(await getRevisionBody(params.id, params.revisionId)),
  },
  {
    method: "POST",
    pattern: ["items", ":id", "revisions", ":revisionId", "restore"],
    handler: async ({ params, auth }) => json({ item: await restoreRevision(params.id, params.revisionId, auth) }),
  },
  // ── Uploads ──
  {
    method: "POST",
    pattern: ["uploads"],
    handler: async ({ request, auth }) => {
      const limited = await checkRateLimit(notesUploadLimiter, `notes-upload:${auth.userId}`);
      if (limited) return limited;
      const input = await body(
        request,
        z.object({
          folderId: id,
          fileName: z.string().trim().min(1).max(200),
          mime: z.string().trim().min(3).max(120),
          bytes: z.number().int().positive(),
          title: z.string().max(300).optional().nullable(),
        }),
      );
      return json(await createLibraryUpload(input, auth), 201);
    },
  },
  {
    method: "POST",
    pattern: ["uploads", "diagram"],
    handler: async ({ request, auth }) => {
      const limited = await checkRateLimit(notesUploadLimiter, `notes-upload:${auth.userId}`);
      if (limited) return limited;
      return json(await uploadNoteDiagram(request, auth), 201);
    },
  },
  {
    method: "POST",
    pattern: ["uploads", ":id", "complete"],
    handler: async ({ request, params, auth }) => {
      const input = await body(request, z.object({ pageCount: z.number().int().min(1).max(9999).optional().nullable() }));
      return json({ item: await completeLibraryUpload(params.id, { pageCount: input.pageCount ?? null }, auth) }, 201);
    },
  },
  // ── Import ──
  {
    method: "POST",
    pattern: ["import", "preview"],
    handler: async ({ request }) => json({ results: await previewImport((await body(request, importSchema)).files) }),
  },
  {
    method: "POST",
    pattern: ["import", "apply"],
    handler: async ({ request, auth }) => json({ results: await applyImport((await body(request, importSchema)).files, auth) }),
  },
  // ── Reports and coverage ──
  {
    method: "GET",
    pattern: ["reports"],
    handler: async ({ request }) =>
      json({ reports: await listReports(request.nextUrl.searchParams.get("status") === "closed" ? "closed" : "open") }),
  },
  {
    method: "POST",
    pattern: ["reports", ":id", "resolve"],
    handler: async ({ request, params, auth }) => {
      const input = await body(request, z.object({ status: z.string(), note: z.string().max(1000).optional().nullable() }));
      await resolveReport(params.id, assertReportStatus(input.status), input.note ?? null, auth);
      return json({ ok: true });
    },
  },
  // Reports about files students shared with friends (Phase 4).
  {
    method: "GET",
    pattern: ["shared-reports"],
    handler: async ({ request }) =>
      json({ reports: await listSharedReports(request.nextUrl.searchParams.get("status") === "closed" ? "closed" : "open") }),
  },
  {
    // POST, not GET: opening a student's private file is an audited action.
    method: "POST",
    pattern: ["shared-reports", ":id", "open"],
    handler: async ({ params, auth }) => json(await openReportedFile(params.id, auth)),
  },
  {
    method: "POST",
    pattern: ["shared-reports", ":id", "remove"],
    handler: async ({ request, params, auth }) => {
      const input = await body(request, z.object({ note: z.string().max(1000).optional().nullable() }));
      await removeReportedFile(params.id, input.note ?? null, auth);
      return json({ ok: true });
    },
  },
  { method: "GET", pattern: ["coverage"], handler: async () => json(await getCoverage()) },
  {
    method: "GET",
    pattern: ["bank-chapters"],
    handler: async ({ request }) => {
      const search = request.nextUrl.searchParams;
      const subjectParam = z.enum(NOTES_SUBJECTS).parse(search.get("subject"));
      const classParam = Number(search.get("class"));
      const chapters = await listOgcodeCatalogFacets({
        level: "chapter",
        subjects: [subjectParam],
        classes: Number.isInteger(classParam) && classParam > 0 ? [classParam] : [],
      });
      return json({ chapters });
    },
  },
  // ── My Notes: storage and settings ──
  { method: "GET", pattern: ["storage", "overview"], handler: async () => json(await getStorageOverview()) },
  {
    method: "GET",
    pattern: ["storage", "users"],
    handler: async ({ request }) => json({ users: await findStorageUsers(request.nextUrl.searchParams.get("q") ?? "") }),
  },
  { method: "GET", pattern: ["storage", "users", ":id"], handler: async ({ params }) => json(await getStorageUser(params.id)) },
  {
    method: "PUT",
    pattern: ["storage", "users", ":id"],
    handler: async ({ request, params, auth }) => json(await updateStorageUser(params.id, await body(request, storageUserSchema), auth)),
  },
  { method: "GET", pattern: ["settings"], handler: async () => json(await getNotesSettings()) },
  {
    method: "PUT",
    pattern: ["settings"],
    handler: async ({ request, auth }) => {
      const patch = await body(request, settingsSchema);
      return json(await updateNotesSettings(patch as Parameters<typeof updateNotesSettings>[0], auth));
    },
  },
  // ── Phase 0 checks ──
  { method: "POST", pattern: ["checks", "storage"], handler: async () => json(await runServerStorageCheck()) },
  { method: "POST", pattern: ["checks", "browser"], handler: async () => json(createBrowserCheck()) },
  {
    method: "POST",
    pattern: ["checks", "browser", "finish"],
    handler: async ({ request }) => {
      const { checkKey } = await body(request, z.object({ checkKey: z.string().max(200) }));
      return json(await finishBrowserCheck(checkKey));
    },
  },
];

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const auth = await requireAdmin(request);
    const slug = getSlugSegments(await context.params);
    const found = findRoute(ROUTES, method, slug);
    if (!found.route) {
      return json({ detail: found.methodMismatch ? "Method not allowed." : "Not found." }, found.methodMismatch ? 405 : 404);
    }
    return await found.route.handler({ request, params: found.params, auth });
  } catch (error) {
    return notesErrorResponse(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return dispatch("GET", request, context);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return dispatch("POST", request, context);
}
export async function PUT(request: NextRequest, context: RouteContext) {
  return dispatch("PUT", request, context);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return dispatch("DELETE", request, context);
}

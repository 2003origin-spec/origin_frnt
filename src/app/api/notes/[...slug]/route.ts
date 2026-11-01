import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireFeatureEnabled } from "@/lib/feature-flags";
import { checkRateLimit, generalLimiter, mutationLimiter, notesReportLimiter, notesShareLimiter, notesUploadLimiter } from "@/lib/rate-limit";
import { NOTES_REPORT_REASONS, SHARED_REPORT_REASONS, type NotesSubject } from "@/lib/notes/types";
import { requireRole, type AuthContext } from "@/server/authz";
import { dbFindUserById } from "@/server/db-users";
import { getSlugSegments, parseJsonBody } from "@/server/http";
import { getStudentScope } from "@/server/study-scope";
import {
  getNotesFolder,
  getNotesHome,
  getNotesItem,
  getNotesItemFileUrl,
  listRecentNotes,
  listStarredNotes,
  reportNotesItem,
  searchNotes,
  setNotesStar,
  type NotesViewer,
} from "@/server/notes/library-student";
import { notesErrorResponse } from "@/server/notes/notes-errors";
import { findRoute, type NotesRoute } from "@/server/notes/notes-routes";
import {
  createMyFolder,
  createMyTypedNote,
  deleteMyFile,
  deleteMyFolder,
  emptyMyBin,
  getMyFile,
  getMyFolder,
  listMyBin,
  purgeFromMyBin,
  restoreFromMyBin,
  searchMyNotes,
  updateMyFile,
  updateMyFolder,
} from "@/server/notes/my-notes";
import { getStorageSummary } from "@/server/notes/my-storage";
import { cancelMyUpload, completeMyUpload, createMyUpload, getMyFileUrl } from "@/server/notes/my-uploads";
import {
  createShares,
  getSharedFile,
  getSharedFileUrl,
  getSharedFolder,
  listShareFriends,
  listSharedWithMe,
  listSharesOut,
  reportSharedFile,
  revokeShare,
  SHARE_BATCH_MAX,
} from "@/server/notes/my-shares";

/**
 * Origin Notes — student API (V1/NOTES_PLAN.md §7). One catch-all on purpose
 * (Next 16 new-route-404 rule, new-frontend/AGENTS.md).
 *
 * Edge: "/api/notes" is an authenticated prefix (src/server/route-policy.ts)
 * and writes pass the mutation limiter + CSRF check in middleware. Here: the
 * `notes` flag, student role, per-user limits.
 *
 *   GET    /api/notes/library/home
 *   GET    /api/notes/library/folders/:id[?all=1]
 *   GET    /api/notes/library/items/:id
 *   GET    /api/notes/library/items/:id/file[?download=1]   → 302 to a signed link
 *   GET    /api/notes/library/search?q=
 *   POST   /api/notes/library/items/:id/star
 *   DELETE /api/notes/library/items/:id/star
 *   POST   /api/notes/library/items/:id/report   { reason, message? }
 *   GET    /api/notes/me/starred
 *   GET    /api/notes/me/recent
 *
 * My Notes (also needs the `notesUploads` flag; every query is scoped to the
 * signed-in student — another student's id answers "not found"):
 *   GET    /api/notes/me/storage
 *   GET    /api/notes/me/folders                 (top level)
 *   GET    /api/notes/me/folders/:id
 *   POST   /api/notes/me/folders                 { parentId, name }
 *   PUT    /api/notes/me/folders/:id             { name?, parentId? }
 *   DELETE /api/notes/me/folders/:id             → Bin
 *   POST   /api/notes/me/notes                   { folderId, title, bodyMd }
 *   GET    /api/notes/me/files/:id
 *   PUT    /api/notes/me/files/:id               { title?, folderId?, bodyMd?, baseVersion? }
 *   DELETE /api/notes/me/files/:id               → Bin
 *   GET    /api/notes/me/files/:id/file[?download=1&format=json]
 *   POST   /api/notes/me/uploads                 { folderId, fileName, mime, bytes, title? } → ticket
 *   POST   /api/notes/me/uploads/:id/complete    { pageCount?, durationS? }
 *   DELETE /api/notes/me/uploads/:id             (gave up: space back at once)
 *   GET    /api/notes/me/bin
 *   POST   /api/notes/me/bin/:id/restore
 *   DELETE /api/notes/me/bin/:id                 (remove for good)
 *   DELETE /api/notes/me/bin                     (empty the Bin)
 *   GET    /api/notes/me/search?q=
 */

type RouteContext = { params: Promise<{ slug?: string[] }> };

type Ctx = {
  request: NextRequest;
  params: Record<string, string>;
  auth: AuthContext;
  viewer: NotesViewer;
};

type Handler = (ctx: Ctx) => Promise<Response>;

const nullableId = z.string().trim().min(1).max(120).nullable();

const myFolderSchema = z.object({ parentId: nullableId, name: z.string().max(200) });
const myFolderPatchSchema = z.object({ name: z.string().max(200).optional(), parentId: nullableId.optional() });
const myNoteSchema = z.object({ folderId: nullableId, title: z.string().max(300), bodyMd: z.string().max(210_000) });
const myFilePatchSchema = z.object({
  title: z.string().max(300).optional(),
  folderId: nullableId.optional(),
  bodyMd: z.string().max(210_000).optional(),
  baseVersion: z.number().int().min(1).optional(),
});
const myUploadSchema = z.object({
  folderId: nullableId,
  fileName: z.string().trim().min(1).max(200),
  mime: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
  title: z.string().max(300).optional().nullable(),
});
const myCompleteSchema = z.object({
  pageCount: z.number().int().min(0).max(100_000).optional().nullable(),
  durationS: z.number().min(0).max(24 * 3600).optional().nullable(),
});

/** My Notes routes answer "not found" while My Notes is switched off. */
function requireMyNotes(): void {
  requireFeatureEnabled("notesUploads");
}

const reportSchema = z.object({
  reason: z.enum(NOTES_REPORT_REASONS),
  message: z.string().trim().max(1000).optional().nullable(),
});

/** Sharing routes answer "not found" unless My Notes, Social and sharing are all switched on. */
function requireSharing(): void {
  requireFeatureEnabled("notesUploads");
  requireFeatureEnabled("studentSocial");
  requireFeatureEnabled("notesSharing");
}

const shareTargetType = z.enum(["file", "folder"]);
const shareSchema = z.object({
  targetType: shareTargetType,
  targetId: z.string().trim().min(1).max(120),
  recipientIds: z.array(z.string().trim().min(1).max(120)).min(1).max(SHARE_BATCH_MAX),
});
const sharedReportSchema = z.object({
  fileId: z.string().trim().min(1).max(120),
  reason: z.enum(SHARED_REPORT_REASONS),
  message: z.string().trim().max(1000).optional().nullable(),
});

function optionalTarget(search: URLSearchParams): { type: "file" | "folder"; id: string } | undefined {
  const type = search.get("targetType");
  const id = search.get("targetId");
  if (!type && !id) return undefined;
  return { type: shareTargetType.parse(type), id: z.string().trim().min(1).max(120).parse(id) };
}

function fileLink(url: string, search: URLSearchParams): Response {
  if (search.get("format") === "json") return json({ url });
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=120" } });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

const ROUTES: NotesRoute<Handler>[] = [
  {
    method: "GET",
    pattern: ["library", "home"],
    handler: async ({ auth, viewer }) => {
      const user = await dbFindUserById(auth.userId).catch(() => null);
      return json(await getNotesHome(viewer, user?.studentClass ?? null));
    },
  },
  {
    method: "GET",
    pattern: ["library", "folders", ":id"],
    handler: async ({ request, params, viewer }) =>
      json(await getNotesFolder(viewer, params.id, request.nextUrl.searchParams.get("all") === "1")),
  },
  {
    method: "GET",
    pattern: ["library", "items", ":id"],
    handler: async ({ params, viewer }) => json(await getNotesItem(viewer, params.id)),
  },
  {
    method: "GET",
    pattern: ["library", "items", ":id", "file"],
    handler: async ({ request, params, viewer }) => {
      const search = request.nextUrl.searchParams;
      const url = await getNotesItemFileUrl(viewer, params.id, search.get("download") === "1");
      // pdf.js asks for JSON and fetches R2 directly: following a same-site →
      // R2 redirect would send `Origin: null`, which the bucket's CORS rules
      // (an explicit origin list) reject. <img> and downloads use the redirect.
      if (search.get("format") === "json") return json({ url });
      // The link itself expires; a short private cache spares a re-sign on back/forward.
      return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=120" } });
    },
  },
  {
    method: "GET",
    pattern: ["library", "search"],
    handler: async ({ request, viewer }) => json({ hits: await searchNotes(viewer, request.nextUrl.searchParams.get("q") ?? "") }),
  },
  {
    method: "POST",
    pattern: ["library", "items", ":id", "star"],
    handler: async ({ params, viewer }) => {
      await setNotesStar(viewer, params.id, true);
      return json({ starred: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["library", "items", ":id", "star"],
    handler: async ({ params, viewer }) => {
      await setNotesStar(viewer, params.id, false);
      return json({ starred: false });
    },
  },
  {
    method: "POST",
    pattern: ["library", "items", ":id", "report"],
    handler: async ({ request, params, viewer }) => {
      const limited = await checkRateLimit(notesReportLimiter, `notes-report:${viewer.userId}`);
      if (limited) return limited;
      const body = reportSchema.parse(await parseJsonBody(request));
      return json(await reportNotesItem(viewer, params.id, body.reason, body.message?.trim() || null), 201);
    },
  },
  {
    method: "GET",
    pattern: ["me", "starred"],
    handler: async ({ viewer }) => json({ items: await listStarredNotes(viewer) }),
  },
  {
    method: "GET",
    pattern: ["me", "recent"],
    handler: async ({ viewer }) => json({ items: await listRecentNotes(viewer) }),
  },

  // ── My Notes ──
  { method: "GET", pattern: ["me", "storage"], handler: async ({ auth }) => {
      requireMyNotes();
      return json(await getStorageSummary(auth.userId));
    } },
  { method: "GET", pattern: ["me", "folders"], handler: async ({ auth }) => {
      requireMyNotes();
      return json(await getMyFolder(auth, null));
    } },
  {
    method: "GET",
    pattern: ["me", "folders", ":id"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      return json(await getMyFolder(auth, params.id));
    },
  },
  {
    method: "POST",
    pattern: ["me", "folders"],
    handler: async ({ request, auth }) => {
      requireMyNotes();
      return json(await createMyFolder(auth, myFolderSchema.parse(await parseJsonBody(request))), 201);
    },
  },
  {
    method: "PUT",
    pattern: ["me", "folders", ":id"],
    handler: async ({ request, auth, params }) => {
      requireMyNotes();
      await updateMyFolder(auth, params.id, myFolderPatchSchema.parse(await parseJsonBody(request)));
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["me", "folders", ":id"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      await deleteMyFolder(auth, params.id);
      return json({ ok: true });
    },
  },
  {
    method: "POST",
    pattern: ["me", "notes"],
    handler: async ({ request, auth }) => {
      requireMyNotes();
      return json(await createMyTypedNote(auth, myNoteSchema.parse(await parseJsonBody(request))), 201);
    },
  },
  { method: "GET", pattern: ["me", "files", ":id"], handler: async ({ auth, params }) => {
      requireMyNotes();
      return json(await getMyFile(auth, params.id));
    } },
  {
    method: "PUT",
    pattern: ["me", "files", ":id"],
    handler: async ({ request, auth, params }) => {
      requireMyNotes();
      return json(await updateMyFile(auth, params.id, myFilePatchSchema.parse(await parseJsonBody(request))));
    },
  },
  {
    method: "DELETE",
    pattern: ["me", "files", ":id"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      await deleteMyFile(auth, params.id);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["me", "files", ":id", "file"],
    handler: async ({ request, auth, params }) => {
      requireMyNotes();
      const search = request.nextUrl.searchParams;
      return fileLink(await getMyFileUrl(auth, params.id, search.get("download") === "1"), search);
    },
  },
  {
    method: "POST",
    pattern: ["me", "uploads"],
    handler: async ({ request, auth }) => {
      requireMyNotes();
      const limited = await checkRateLimit(notesUploadLimiter, `notes-upload:${auth.userId}`);
      if (limited) return limited;
      return json(await createMyUpload(auth, myUploadSchema.parse(await parseJsonBody(request))), 201);
    },
  },
  {
    method: "POST",
    pattern: ["me", "uploads", ":id", "complete"],
    handler: async ({ request, auth, params }) => {
      requireMyNotes();
      return json(await completeMyUpload(auth, params.id, myCompleteSchema.parse(await parseJsonBody(request))), 201);
    },
  },
  {
    method: "DELETE",
    pattern: ["me", "uploads", ":id"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      await cancelMyUpload(auth, params.id);
      return json({ ok: true });
    },
  },
  { method: "GET", pattern: ["me", "bin"], handler: async ({ auth }) => {
      requireMyNotes();
      return json(await listMyBin(auth));
    } },
  {
    method: "POST",
    pattern: ["me", "bin", ":id", "restore"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      await restoreFromMyBin(auth, params.id);
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["me", "bin", ":id"],
    handler: async ({ auth, params }) => {
      requireMyNotes();
      await purgeFromMyBin(auth, params.id);
      return json({ ok: true });
    },
  },
  {
    method: "DELETE",
    pattern: ["me", "bin"],
    handler: async ({ auth }) => {
      requireMyNotes();
      return json(await emptyMyBin(auth));
    },
  },
  {
    method: "GET",
    pattern: ["me", "search"],
    handler: async ({ request, auth }) => {
      requireMyNotes();
      return json({ hits: await searchMyNotes(auth, request.nextUrl.searchParams.get("q") ?? "") });
    },
  },
  // ── Sharing with mutual friends (Phase 4) ──
  {
    method: "GET",
    pattern: ["friends"],
    handler: async ({ request, auth }) => {
      requireSharing();
      const search = request.nextUrl.searchParams;
      const target = optionalTarget(search);
      const friends = await listShareFriends(auth, {
        query: (search.get("q") ?? "").slice(0, 80),
        targetType: target?.type,
        targetId: target?.id,
      });
      return json({ friends });
    },
  },
  {
    method: "POST",
    pattern: ["shares"],
    handler: async ({ request, auth }) => {
      requireSharing();
      const limited = await checkRateLimit(notesShareLimiter, `notes-share:${auth.userId}`);
      if (limited) return limited;
      return json({ shares: await createShares(auth, shareSchema.parse(await parseJsonBody(request))) }, 201);
    },
  },
  {
    method: "GET",
    pattern: ["shares", "out"],
    handler: async ({ request, auth }) => {
      requireSharing();
      return json({ shares: await listSharesOut(auth, optionalTarget(request.nextUrl.searchParams)) });
    },
  },
  {
    method: "DELETE",
    pattern: ["shares", ":id"],
    handler: async ({ auth, params }) => {
      requireSharing();
      await revokeShare(auth, params.id);
      return json({ ok: true });
    },
  },
  {
    method: "GET",
    pattern: ["shared"],
    handler: async ({ auth }) => {
      requireSharing();
      return json(await listSharedWithMe(auth));
    },
  },
  {
    method: "GET",
    pattern: ["shared", ":shareId"],
    handler: async ({ request, auth, params }) => {
      requireSharing();
      const folder = request.nextUrl.searchParams.get("folder");
      return json(await getSharedFolder(auth, params.shareId, folder ? folder.slice(0, 120) : null));
    },
  },
  {
    method: "GET",
    pattern: ["shared", ":shareId", "files", ":fileId"],
    handler: async ({ auth, params }) => {
      requireSharing();
      return json(await getSharedFile(auth, params.shareId, params.fileId));
    },
  },
  {
    method: "GET",
    pattern: ["shared", ":shareId", "files", ":fileId", "file"],
    handler: async ({ request, auth, params }) => {
      requireSharing();
      const search = request.nextUrl.searchParams;
      return fileLink(await getSharedFileUrl(auth, params.shareId, params.fileId, search.get("download") === "1"), search);
    },
  },
  {
    method: "POST",
    pattern: ["shared", ":shareId", "report"],
    handler: async ({ request, auth, params }) => {
      requireSharing();
      const limited = await checkRateLimit(notesReportLimiter, `notes-report:${auth.userId}`);
      if (limited) return limited;
      const body = sharedReportSchema.parse(await parseJsonBody(request));
      return json(await reportSharedFile(auth, params.shareId, body.fileId, body.reason, body.message?.trim() || null), 201);
    },
  },
];

async function viewerFor(auth: AuthContext): Promise<NotesViewer> {
  const scope = await getStudentScope(auth.userId, auth.role);
  return {
    userId: auth.userId,
    modeSubjects: scope.enforced ? (scope.modeSubjects as NotesSubject[]) : null,
    ownedSubjects: scope.ownedSubjects as NotesSubject[],
  };
}

async function dispatch(method: string, request: NextRequest, context: RouteContext): Promise<Response> {
  try {
    requireFeatureEnabled("notes");
    const auth = await requireRole(request, ["student"]);
    const slug = getSlugSegments(await context.params);
    const found = findRoute(ROUTES, method, slug);
    if (!found.route) {
      return json({ detail: found.methodMismatch ? "Method not allowed." : "Not found." }, found.methodMismatch ? 405 : 404);
    }
    const limited = await checkRateLimit(method === "GET" ? generalLimiter : mutationLimiter, `notes:${auth.userId}`);
    if (limited) return limited;
    return await found.route.handler({ request, params: found.params, auth, viewer: await viewerFor(auth) });
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

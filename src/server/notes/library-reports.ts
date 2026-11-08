/**
 * Origin Notes — admin Reports and Coverage tabs (V1/NOTES_PLAN.md §4).
 */

import { breadcrumbFor } from "@/lib/notes/rules";
import type { NotesCrumb, NotesReportReason, NotesSubject } from "@/lib/notes/types";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { getLibraryTree } from "./library-store";
import { notesPool, toIso, toIsoOrNull, toNumber } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";

export type NotesReportView = {
  id: string;
  reason: NotesReportReason;
  message: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  reporterName: string | null;
  itemId: string;
  itemTitle: string | null;
  breadcrumb: NotesCrumb[];
  resolutionNote: string | null;
  resolvedAt: string | null;
};

export async function listReports(status: "open" | "closed"): Promise<NotesReportView[]> {
  await ensureNotesSchema();
  const tree = await getLibraryTree();
  const result = await notesPool().query(
    `SELECT r.id, r.reason, r.message, r.status, r.created_at, r.resolution_note, r.resolved_at,
            u.name AS reporter_name, i.id AS item_id, i.title, i.folder_id
       FROM notes.reports r
       LEFT JOIN origin_users u ON u.id = r.reporter_id
       LEFT JOIN notes.items i ON i.id = r.target_id
      WHERE r.target_type = 'library_item' AND ${status === "open" ? "r.status = 'open'" : "r.status <> 'open'"}
      ORDER BY r.created_at DESC LIMIT 200`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    reason: row.reason as NotesReportReason,
    message: (row.message as string | null) ?? null,
    status: row.status as NotesReportView["status"],
    createdAt: toIso(row.created_at),
    reporterName: (row.reporter_name as string | null) ?? null,
    itemId: String(row.item_id ?? ""),
    itemTitle: (row.title as string | null) ?? null,
    breadcrumb: row.folder_id ? breadcrumbFor(tree, String(row.folder_id)) : [],
    resolutionNote: (row.resolution_note as string | null) ?? null,
    resolvedAt: toIsoOrNull(row.resolved_at),
  }));
}

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed",
  note: string | null,
  actor: AdminActor,
): Promise<void> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `UPDATE notes.reports SET status = $2, resolution_note = $3, resolved_by = $4, resolved_at = now()
      WHERE id = $1 AND status = 'open'`,
    [reportId, status, note?.slice(0, 1000) ?? null, actor.userId],
  );
  if (!result.rowCount) throw notFoundError("That open report");
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_report",
    entityId: reportId,
    action: `notes.report.${status}`,
    after: { note },
  }).catch(() => undefined);
}

export type CoverageRow = {
  folderId: string;
  classLevel: number | null;
  subject: NotesSubject | null;
  name: string;
  chapters: number;
  chaptersWithNotes: number;
  published: number;
  inReview: number;
  draft: number;
  visible: boolean;
};

export type CoverageReport = {
  subjects: CoverageRow[];
  topViewed: Array<{ itemId: string; title: string; views: number; students: number; breadcrumb: NotesCrumb[] }>;
  openReports: number;
  unlinkedChapters: number;
};

/** Per subject folder: how many of its chapters already have published notes. */
export async function getCoverage(): Promise<CoverageReport> {
  await ensureNotesSchema();
  const tree = await getLibraryTree();
  const subjects: CoverageRow[] = [];
  let unlinkedChapters = 0;
  for (const node of Object.values(tree.nodes)) {
    if (node.kind === "chapter" && node.ncertNumber !== null && node.bankChapters.length === 0 && node.exams.some((e) => e !== "boards")) {
      unlinkedChapters += 1;
    }
    if (node.kind !== "subject") continue;
    const chapters = node.children.map((id) => tree.nodes[id]).filter((child) => child?.kind === "chapter");
    const totals = chapters.reduce(
      (sum, child) => ({
        published: sum.published + child.counts.published,
        inReview: sum.inReview + child.counts.inReview,
        draft: sum.draft + child.counts.draft,
      }),
      { published: 0, inReview: 0, draft: 0 },
    );
    subjects.push({
      folderId: node.id,
      classLevel: node.effectiveClassLevel,
      subject: node.effectiveSubject,
      name: breadcrumbFor(tree, node.id).map((crumb) => crumb.name).join(" › "),
      chapters: chapters.length,
      chaptersWithNotes: chapters.filter((child) => child.counts.published > 0).length,
      ...totals,
      visible: node.visible,
    });
  }
  subjects.sort((a, b) => (a.classLevel ?? 0) - (b.classLevel ?? 0) || a.name.localeCompare(b.name));

  const pool = notesPool();
  const [top, open] = await Promise.all([
    pool.query(
      `SELECT v.item_id, i.title, i.folder_id, SUM(v.view_count) AS views, COUNT(*) AS students
         FROM notes.views v JOIN notes.items i ON i.id = v.item_id
        WHERE i.deleted_at IS NULL
        GROUP BY v.item_id, i.title, i.folder_id
        ORDER BY views DESC LIMIT 10`,
    ),
    pool.query(`SELECT COUNT(*) AS n FROM notes.reports WHERE status = 'open'`),
  ]);
  return {
    subjects,
    topViewed: top.rows.map((row) => ({
      itemId: String(row.item_id),
      title: String(row.title),
      views: toNumber(row.views) ?? 0,
      students: toNumber(row.students) ?? 0,
      breadcrumb: breadcrumbFor(tree, String(row.folder_id)),
    })),
    openReports: toNumber(open.rows[0]?.n) ?? 0,
    unlinkedChapters,
  };
}

export function assertReportStatus(value: unknown): "resolved" | "dismissed" {
  if (value === "resolved" || value === "dismissed") return value;
  throw new NotesError(400, "invalid_status", "Mark the report resolved or dismissed.");
}

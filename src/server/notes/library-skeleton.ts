/**
 * Origin Notes — "Create standard folders" (V1/NOTES_PLAN.md Appendix A).
 *
 * Builds Class 10/11/12 → subject → chapter folders from NOTES_SYLLABUS, all as
 * drafts. Safe to run again: a folder whose syllabus key already exists is
 * skipped (including ones an admin deleted on purpose), and a folder an admin
 * already made by hand with the same name in the same place is adopted — it
 * gets the key and chapter details instead of a duplicate.
 */

import { NOTES_SYLLABUS } from "@/lib/notes/syllabus";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { bumpLibraryVersion, createNotesFolderId, withNotesTransaction } from "./notes-db";

export type SkeletonResult = { created: number; adopted: number; skipped: number };

type Spec = {
  key: string;
  name: string;
  kind: "class" | "subject" | "chapter";
  classLevel: number | null;
  subject: string | null;
  ncertNumber: number | null;
  bankChapters: string[];
  exams: string[];
  sortOrder: number;
};

export async function createStandardFolders(actor: AdminActor, classLevels?: number[]): Promise<SkeletonResult> {
  const wanted = classLevels?.length ? new Set(classLevels) : null;
  const result: SkeletonResult = { created: 0, adopted: 0, skipped: 0 };

  await withNotesTransaction(async (client) => {
    const existing = await client.query(`SELECT id, syllabus_key, deleted_at FROM notes.folders WHERE syllabus_key IS NOT NULL`);
    const byKey = new Map<string, { id: string; deleted: boolean }>(
      existing.rows.map((row) => [String(row.syllabus_key), { id: String(row.id), deleted: Boolean(row.deleted_at) }]),
    );

    /** Returns the folder id for `spec` under `parentId`, or null to skip its subtree. */
    const place = async (spec: Spec, parentId: string | null): Promise<string | null> => {
      const known = byKey.get(spec.key);
      if (known) {
        result.skipped += 1;
        return known.deleted ? null : known.id;
      }
      const sameName = await client.query(
        `SELECT id, syllabus_key FROM notes.folders
          WHERE COALESCE(parent_id, '') = COALESCE($1::text, '') AND lower(name) = lower($2) AND deleted_at IS NULL`,
        [parentId, spec.name],
      );
      const match = sameName.rows[0];
      if (match) {
        if (match.syllabus_key) {
          result.skipped += 1;
          return String(match.id);
        }
        await client.query(
          `UPDATE notes.folders
              SET syllabus_key = $2, kind = $3,
                  class_level = COALESCE(class_level, $4), subject = COALESCE(subject, $5),
                  ncert_number = COALESCE(ncert_number, $6),
                  bank_chapters = CASE WHEN cardinality(bank_chapters) = 0 THEN $7::text[] ELSE bank_chapters END,
                  exams = CASE WHEN cardinality(exams) = 0 THEN $8::text[] ELSE exams END,
                  updated_by = $9, updated_at = now()
            WHERE id = $1`,
          [match.id, spec.key, spec.kind, spec.classLevel, spec.subject, spec.ncertNumber, spec.bankChapters, spec.exams, actor.userId],
        );
        byKey.set(spec.key, { id: String(match.id), deleted: false });
        result.adopted += 1;
        return String(match.id);
      }
      const id = createNotesFolderId();
      await client.query(
        `INSERT INTO notes.folders
           (id, parent_id, name, kind, class_level, subject, syllabus_key, ncert_number, bank_chapters, exams, sort_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
        [id, parentId, spec.name, spec.kind, spec.classLevel, spec.subject, spec.key, spec.ncertNumber, spec.bankChapters, spec.exams, spec.sortOrder, actor.userId],
      );
      byKey.set(spec.key, { id, deleted: false });
      result.created += 1;
      return id;
    };

    for (const [classIndex, cls] of NOTES_SYLLABUS.entries()) {
      if (wanted && !wanted.has(cls.classLevel)) continue;
      // Class 10 first in the data; on screen the student's own class leads anyway.
      const classId = await place(
        { key: cls.key, name: cls.name, kind: "class", classLevel: cls.classLevel, subject: null, ncertNumber: null, bankChapters: [], exams: [], sortOrder: (classIndex + 1) * 10 },
        null,
      );
      if (!classId) continue;
      for (const [subjectIndex, sub] of cls.subjects.entries()) {
        const subjectId = await place(
          { key: sub.key, name: sub.name, kind: "subject", classLevel: null, subject: sub.subject, ncertNumber: null, bankChapters: [], exams: [], sortOrder: (subjectIndex + 1) * 10 },
          classId,
        );
        if (!subjectId) continue;
        for (const [chapterIndex, chapter] of sub.chapters.entries()) {
          await place(
            {
              key: chapter.key,
              name: chapter.name,
              kind: "chapter",
              classLevel: null,
              subject: null,
              ncertNumber: chapter.ncertNumber,
              bankChapters: chapter.bankChapters,
              exams: chapter.exams,
              sortOrder: (chapterIndex + 1) * 10,
            },
            subjectId,
          );
        }
      }
    }
    if (result.created > 0 || result.adopted > 0) await bumpLibraryVersion(client);
  });

  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_folder",
    entityId: "standard-folders",
    action: "notes.folder.create_standard",
    after: { ...result, classLevels: classLevels ?? "all" },
  }).catch(() => undefined);
  return result;
}

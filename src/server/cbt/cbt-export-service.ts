/**
 * CBT results → Excel workbook. exceljs is imported dynamically inside the
 * builder so it never bloats the shared server bundle. Teacher-scoped:
 * ownership is enforced by the caller and re-checked in the room query.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureCbtSchema } from "./cbt-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function participantStatusLabel(finishedAt: unknown, autoSubmitted: unknown): string {
  if (!finishedAt) return "absent";
  return autoSubmitted ? "auto-submitted" : "submitted";
}

function fmtTime(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function slugifyFilename(name: string): string {
  return (name || "room").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "room";
}

export async function buildResultsWorkbook(
  teacherId: string,
  roomId: string,
  opts: { detail?: boolean } = {},
): Promise<{ body: ArrayBuffer; filename: string } | null> {
  await ensureCbtSchema();

  const roomRes = await pool().query(
    `SELECT r.name, r.created_at, r.test_id, t.title AS test_title
       FROM cbt.rooms r LEFT JOIN cbt.tests t ON t.id = r.test_id
      WHERE r.id = $1 AND r.teacher_id = $2`,
    [roomId, teacherId],
  );
  const room = roomRes.rows[0];
  if (!room) return null;

  const parts = await pool().query(
    `SELECT id, display_name, student_code, score, max_score, rank, time_taken_seconds,
            joined_at, finished_at, auto_submitted
       FROM cbt.room_participants
      WHERE room_id = $1
      ORDER BY (finished_at IS NULL), rank ASC NULLS LAST, score DESC NULLS LAST, joined_at ASC`,
    [roomId],
  );

  const ExcelJSNS = await import("exceljs");
  // exceljs is CJS: under Node ESM the class lives on `.default`; fall back to
  // the namespace when a bundler has already interop-flattened it.
  const ExcelJS = (ExcelJSNS as unknown as { default?: typeof ExcelJSNS }).default ?? ExcelJSNS;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Origin CBT";
  workbook.created = new Date();

  // ── Results sheet ──────────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Results");
  sheet.addRow([`Room: ${room.name ?? ""}`]);
  sheet.addRow([`Test: ${room.test_title ?? "—"}`]);
  sheet.addRow([`Exported: ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC`]);
  sheet.addRow([]);

  const headerRow = sheet.addRow([
    "Rank",
    "Name",
    "Student ID",
    "Score",
    "Max Score",
    "Percentage",
    "Time Taken",
    "Joined At",
    "Submitted At",
    "Status",
  ]);
  headerRow.font = { bold: true };

  for (const p of parts.rows) {
    const score = p.score != null ? Number(p.score) : null;
    const maxScore = p.max_score != null ? Number(p.max_score) : null;
    const pct = score != null && maxScore ? `${((score / maxScore) * 100).toFixed(1)}%` : "";
    sheet.addRow([
      p.rank ?? "",
      p.display_name ?? "",
      p.student_code ?? "",
      score ?? "",
      maxScore ?? "",
      pct,
      fmtTime(p.time_taken_seconds != null ? Number(p.time_taken_seconds) : null),
      p.joined_at ? new Date(p.joined_at).toISOString().replace("T", " ").slice(0, 16) : "",
      p.finished_at ? new Date(p.finished_at).toISOString().replace("T", " ").slice(0, 16) : "",
      participantStatusLabel(p.finished_at, p.auto_submitted),
    ]);
  }
  sheet.columns.forEach((col) => {
    col.width = 16;
  });

  // ── Optional per-question detail sheet ──────────────────────────────────────
  if (opts.detail && room.test_id) {
    const positions = await pool().query(
      `SELECT position FROM cbt.test_questions WHERE test_id = $1 ORDER BY position ASC`,
      [room.test_id],
    );
    const posList = positions.rows.map((r) => Number(r.position));

    const answers = await pool().query(
      `SELECT participant_id, position, marks_awarded
         FROM cbt.submission_answers WHERE room_id = $1`,
      [roomId],
    );
    const byParticipant = new Map<string, Map<number, number>>();
    for (const a of answers.rows) {
      const pid = String(a.participant_id);
      if (!byParticipant.has(pid)) byParticipant.set(pid, new Map());
      byParticipant.get(pid)!.set(Number(a.position), Number(a.marks_awarded ?? 0));
    }

    const detail = workbook.addWorksheet("Per-question");
    const detailHeader = detail.addRow(["Name", "Student ID", ...posList.map((p) => `Q${p}`)]);
    detailHeader.font = { bold: true };
    for (const p of parts.rows) {
      const marks = byParticipant.get(String(p.id)) ?? new Map<number, number>();
      detail.addRow([p.display_name ?? "", p.student_code ?? "", ...posList.map((pos) => marks.get(pos) ?? "")]);
    }
    detail.columns.forEach((col) => {
      col.width = 12;
    });
  }

  const body = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return { body, filename: `cbt-${slugifyFilename(room.name)}-results.xlsx` };
}

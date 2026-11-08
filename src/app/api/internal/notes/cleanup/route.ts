/**
 * GET | POST /api/internal/notes/cleanup — Origin Notes daily cleanup (cron).
 *
 * Expires abandoned upload tickets (and gives their space back), removes Bin
 * items older than the Bin days, removes deleted accounts' files and recounts
 * every storage meter. Idempotent — safe to run again. See my-cleanup.ts.
 *
 * GET because Vercel Cron issues GET (POST kept for a manual run).
 * Auth: requireCronCaller. Not behind the student flags: admin library uploads
 * leave tickets to expire too. Plan: V1/NOTES_PLAN.md §7.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { runNotesCleanup } from "@/server/notes/my-cleanup";
import { notesErrorResponse } from "@/server/notes/notes-errors";

async function run(request: NextRequest) {
  try {
    await requireCronCaller(request);
    if (!isUserPostgresConfigured()) return NextResponse.json({ ok: true, skipped: "no database" });
    return NextResponse.json({ ok: true, ...(await runNotesCleanup()) });
  } catch (error) {
    return notesErrorResponse(error);
  }
}

export const GET = run;
export const POST = run;

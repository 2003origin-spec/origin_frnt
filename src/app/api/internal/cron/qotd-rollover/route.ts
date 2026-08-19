import { NextResponse, type NextRequest } from "next/server";

import { requireCronCaller } from "@/server/authz";
import { istDateKey } from "@/lib/ist-day";
import { runDailyQuestionRollover } from "@/server/ogcode-daily-question";

/**
 * GET|POST /api/internal/cron/qotd-rollover
 *
 * Draws the day's Question-of-the-Day bags — one question per subject per class
 * band, four rows today. Scheduled in vercel.json at `30 18 * * *` UTC, which is
 * 00:00 IST (Vercel cron schedules are UTC; the product is India-only).
 *
 * This is an OPTIMISATION, not a correctness dependency: every read path lazily
 * draws a missing bag on first request, so a skipped run, a cold preview deploy
 * or a local box with no scheduler still serves the right card. What the cron
 * buys is that the first student of the day gets a warm cache instead of paying
 * for four draws.
 *
 * Idempotent: each bag is unique per (day, band, subject), so a re-run — manual
 * or retried — returns the same questions rather than re-drawing them.
 *
 * Authenticated by CRON_SECRET (Vercel's own) or INTERNAL_CRON_TOKEN (manual
 * runs), matching /api/internal/cbt/drain.
 */
async function handle(request: NextRequest) {
  try {
    await requireCronCaller(request);

    const dateKey = istDateKey();
    const { draws, skipped } = await runDailyQuestionRollover(dateKey);

    return NextResponse.json({
      ok: true,
      dateKey,
      drawn: draws.length,
      // `skipped` is normal, not an error: the junior band holds no questions
      // until class 9-10 content is imported.
      skipped,
      draws: draws.map((draw) => ({
        band: draw.band,
        subject: draw.subject,
        questionId: draw.questionId,
        cycle: draw.cycle,
        recycled: draw.recycled,
      })),
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json({ error: (error as Error).message }, { status });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

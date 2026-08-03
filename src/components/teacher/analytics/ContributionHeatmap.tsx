"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type ContributionDay = { date: string; count: number };

/**
 * Five-step intensity, mirroring the student-facing Activity Vault so the same
 * activity looks the same to the student and to their teacher.
 */
const LEVEL_CLASSES = [
  "bg-muted",
  "bg-emerald-500/25",
  "bg-emerald-500/45",
  "bg-emerald-500/65",
  "bg-emerald-500/90",
] as const;

function levelOf(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 1;
  // Quartiles of the student's OWN best day: a 5-question day is meaningful for
  // a light user and unremarkable for a heavy one, so a fixed scale would
  // misrepresent both.
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

/**
 * GitHub-style study-activity grid. Days flow top-to-bottom within a week
 * column, weeks left-to-right — the layout every user already recognises.
 *
 * Dates are the IST day-strings the activity rows were written with and are
 * rendered verbatim; re-deriving them from a JS Date would shift the grid by a
 * day for anyone west of IST (ledger #10).
 */
export function ContributionHeatmap({ days }: { days: ContributionDay[] }) {
  const { columns, max, total } = useMemo(() => {
    const maxCount = days.reduce((peak, day) => Math.max(peak, day.count), 0);
    const totalCount = days.reduce((sum, day) => sum + day.count, 0);
    // Chunk into 7-day columns, keeping the trailing partial week last.
    const cols: ContributionDay[][] = [];
    for (let i = 0; i < days.length; i += 7) cols.push(days.slice(i, i + 7));
    return { columns: cols, max: maxCount, total: totalCount };
  }, [days]);

  if (days.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {columns.map((week, index) => (
          <div key={week[0]?.date ?? index} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <span
                key={day.date}
                className={cn("size-3 rounded-[2px]", LEVEL_CLASSES[levelOf(day.count, max)])}
                title={`${day.date}: ${day.count} ${day.count === 1 ? "question" : "questions"} practised`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.65rem] text-muted-foreground">
        <span>
          {total} question{total === 1 ? "" : "s"} practised across {days.length} days
        </span>
        <span className="flex items-center gap-1">
          Less
          {LEVEL_CLASSES.map((className, level) => (
            <span key={level} className={cn("size-2.5 rounded-[2px]", className)} aria-hidden="true" />
          ))}
          More
        </span>
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { formatPercent, scoreTone, TONE_SURFACE } from "@/lib/teacher-analytics";

export type HeatmapData = {
  batches: Array<{ id: string; name: string }>;
  rows: Array<{
    subject: string;
    cells: Array<{ batchId: string; accuracy: number | null; attempts: number }>;
  }>;
};

/**
 * Subject × batch accuracy grid.
 *
 * Built as a real `<table>`, not a canvas: it stays readable to a screen reader,
 * scrolls horizontally on a phone instead of overflowing the page, and — the
 * important part — **prints the number inside every cell**. Colour is a second
 * channel, never the only one (ledger #24).
 */
export function SubjectBatchHeatmap({ data }: { data: HeatmapData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Average accuracy per subject for each batch, as a percentage.
        </caption>
        <thead>
          <tr className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-semibold">
              Subject
            </th>
            {data.batches.map((batch) => (
              <th key={batch.id} scope="col" className="px-2 py-2 text-center font-semibold">
                <span className="line-clamp-2 max-w-[7rem] break-words">{batch.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.subject}>
              <th
                scope="row"
                className="whitespace-nowrap py-2 pr-3 text-xs font-semibold capitalize"
              >
                {row.subject}
              </th>
              {row.cells.map((cell) => {
                const tone = scoreTone(cell.accuracy);
                return (
                  <td key={cell.batchId} className="px-1.5 py-1.5 text-center">
                    <span
                      className={cn(
                        "inline-flex h-8 w-full min-w-[3.25rem] items-center justify-center rounded-md border font-mono text-xs font-bold tabular-nums",
                        TONE_SURFACE[tone],
                      )}
                      title={
                        cell.accuracy == null
                          ? "No attempts recorded for this subject in this batch"
                          : `${cell.accuracy.toFixed(1)}% across ${cell.attempts} attempts`
                      }
                    >
                      {formatPercent(cell.accuracy)}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

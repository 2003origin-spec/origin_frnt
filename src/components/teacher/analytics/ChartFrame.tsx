"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared tooltip shell for every recharts surface in the epic — one card style
 * instead of six slightly-different inline objects. recharts renders this inside
 * an SVG foreignObject, so it must not rely on parent layout.
 */
export function ChartTooltipCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1 text-xs font-semibold">{title}</p>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[0.7rem]">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            ) : null}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Fixed-height, overflow-safe wrapper for a chart.
 *
 * recharts' ResponsiveContainer needs a bounded parent or it collapses to 0px;
 * `min-w-0` stops a wide chart from forcing the page into horizontal scroll
 * inside a grid/flex column.
 */
export function ChartFrame({
  height = 260,
  className,
  children,
}: {
  height?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("w-full min-w-0", className)} style={{ height }}>
      {children}
    </div>
  );
}

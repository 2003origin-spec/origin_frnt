"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  CHART_COLORS,
  scoreTone,
  TONE_HEX,
  truncateLabel,
} from "@/lib/teacher-analytics";

import { ChartFrame, ChartTooltipCard } from "./ChartFrame";

export type BatchComparisonDatum = {
  batchId: string;
  name: string;
  averagePercentage: number | null;
  topPercentage: number | null;
  rankedStudents: number;
};

/**
 * Average score per batch, colour-banded by performance tier with the value
 * printed on each bar — colour alone is never the signal (ledger #24), and
 * labelled bars are the accessible default for category comparison.
 *
 * Batches with no submissions are dropped rather than drawn as 0%-tall bars.
 */
export function BatchComparisonChart({ data }: { data: BatchComparisonDatum[] }) {
  const rows = data
    .filter((d) => d.averagePercentage != null)
    .map((d) => ({
      ...d,
      label: truncateLabel(d.name, 16),
      average: d.averagePercentage as number,
      top: d.topPercentage ?? 0,
    }));

  return (
    <ChartFrame height={280}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 18, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            content={({ active, payload }) => {
              const row = active && payload?.length ? (payload[0].payload as (typeof rows)[number]) : null;
              if (!row) return null;
              return (
                <ChartTooltipCard
                  title={row.name}
                  rows={[
                    { label: "Average", value: `${row.average.toFixed(1)}%`, color: TONE_HEX[scoreTone(row.average)] },
                    { label: "Top", value: `${row.top.toFixed(1)}%`, color: CHART_COLORS.primary },
                    { label: "Ranked students", value: String(row.rankedStudents) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="average" radius={[6, 6, 0, 0]} maxBarSize={54} isAnimationActive={false}>
            {rows.map((row) => (
              <Cell key={row.batchId} fill={TONE_HEX[scoreTone(row.average)]} fillOpacity={0.85} />
            ))}
            <LabelList
              dataKey="average"
              position="top"
              formatter={(value) => (typeof value === "number" ? `${Math.round(value)}%` : "")}
              className="fill-muted-foreground"
              style={{ fontSize: 10, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

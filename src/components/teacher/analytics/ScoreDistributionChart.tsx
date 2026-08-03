"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, TONE_HEX, type ScoreBucket } from "@/lib/teacher-analytics";

import { ChartFrame, ChartTooltipCard } from "./ChartFrame";

/**
 * Histogram of student mean percentages across ten mark bands.
 *
 * Each bar is toned by its band so the shape of the cohort reads at a glance —
 * a left-heavy chart is immediately "most of this batch is failing".
 */
export function ScoreDistributionChart({
  buckets,
  height = 240,
}: {
  buckets: ScoreBucket[];
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 4, left: -22 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            tick={{ fontSize: 9 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            content={({ active, payload }) => {
              const row = active && payload?.length ? (payload[0].payload as ScoreBucket) : null;
              if (!row) return null;
              return (
                <ChartTooltipCard
                  title={`${row.label} band`}
                  rows={[
                    {
                      label: row.count === 1 ? "student" : "students",
                      value: String(row.count),
                      color: TONE_HEX[row.tone],
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={44} isAnimationActive={false}>
            {buckets.map((bucket) => (
              <Cell key={bucket.label} fill={TONE_HEX[bucket.tone]} fillOpacity={0.75} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

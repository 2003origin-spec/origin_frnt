"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, movingAverage } from "@/lib/teacher-analytics";

import { ChartFrame, ChartTooltipCard } from "./ChartFrame";

export type TrendPoint = { date: string; percentage: number; title: string };

function shortDate(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Score over time with a 3-point trailing average overlay.
 *
 * The raw line answers "how did this test go", the trend line answers "is this
 * going anywhere" — which is the question a teacher actually has. A single data
 * point still renders (as a dot) rather than an empty plot.
 */
export function ScoreTrendChart({
  points,
  height = 240,
  label = "Score",
}: {
  points: TrendPoint[];
  height?: number;
  label?: string;
}) {
  const data = useMemo(() => {
    const trend = movingAverage(points.map((p) => p.percentage), 3);
    return points.map((point, i) => ({
      ...point,
      shortDate: shortDate(point.date),
      trend: trend[i],
    }));
  }, [points]);

  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: -20 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="shortDate"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            minTickGap={16}
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
            content={({ active, payload }) => {
              const row = active && payload?.length ? (payload[0].payload as (typeof data)[number]) : null;
              if (!row) return null;
              return (
                <ChartTooltipCard
                  title={row.title}
                  rows={[
                    { label, value: `${row.percentage.toFixed(1)}%`, color: CHART_COLORS.accent },
                    ...(row.trend != null
                      ? [{ label: "3-test average", value: `${row.trend.toFixed(1)}%`, color: CHART_COLORS.primary }]
                      : []),
                    { label: "Date", value: shortDate(row.date) },
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="percentage"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: CHART_COLORS.accent }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={CHART_COLORS.primary}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

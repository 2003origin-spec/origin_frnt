"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_COLORS, formatDuration } from "@/lib/teacher-analytics";

import { ChartFrame, ChartTooltipCard } from "./ChartFrame";

export type TimeAnalyticsDatum = {
  date: string;
  dayName: string;
  webpageTime: number;
  practiceTime: number;
  pomodoroTime: number;
};

const SERIES = [
  { key: "practiceTime", label: "Practice", color: CHART_COLORS.accent },
  { key: "pomodoroTime", label: "Pomodoro", color: CHART_COLORS.primary },
  { key: "webpageTime", label: "Browsing", color: CHART_COLORS.violet },
] as const;

/**
 * Last-7-day study split, stacked so total time and its composition read at
 * once. Values are MINUTES as gamification records them.
 *
 * The series is always dense (7 bars) — a day with no activity shows as an empty
 * slot, which is itself the signal a teacher is looking for.
 */
export function TimeAnalyticsChart({
  data,
  height = 220,
}: {
  data: TimeAnalyticsDatum[];
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="dayName"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => `${v}m`}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: "currentColor", opacity: 0.06 }}
            content={({ active, payload }) => {
              const row = active && payload?.length ? (payload[0].payload as TimeAnalyticsDatum) : null;
              if (!row) return null;
              const total = row.practiceTime + row.pomodoroTime + row.webpageTime;
              return (
                <ChartTooltipCard
                  title={row.date}
                  rows={[
                    ...SERIES.map((series) => ({
                      label: series.label,
                      value: formatDuration(row[series.key] * 60),
                      color: series.color,
                    })),
                    { label: "Total", value: formatDuration(total * 60) },
                  ]}
                />
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={7} />
          {SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId="time"
              fill={series.color}
              fillOpacity={0.8}
              maxBarSize={38}
              isAnimationActive={false}
              radius={series.key === "webpageTime" ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

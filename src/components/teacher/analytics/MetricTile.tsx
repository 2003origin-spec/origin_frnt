import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE_TEXT, type ScoreTone } from "@/lib/teacher-analytics";

type Props = {
  label: string;
  /** Pre-formatted. Pass `—` (not "0") when there is no underlying data. */
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** Colours the value. Defaults to plain foreground. */
  tone?: ScoreTone;
  className?: string;
};

/**
 * The KPI tile used across the Overview, batch deep-dive, and student 360°.
 *
 * Deliberately dumb: the caller formats the value (so "no data" reads as an
 * em-dash rather than a fabricated 0) and picks the tone. Matches the existing
 * teacher card rhythm — `rounded-xl border bg-card`, uppercase micro-label.
 */
export function MetricTile({ label, value, hint, icon: Icon, tone, className }: Props) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums tracking-tight",
          tone ? TONE_TEXT[tone] : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-1 text-[0.7rem] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

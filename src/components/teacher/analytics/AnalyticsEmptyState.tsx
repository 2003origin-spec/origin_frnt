import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  icon?: LucideIcon;
  title: string;
  /** One sentence explaining what has to happen for data to appear. */
  description: string;
  className?: string;
};

/**
 * The empty state every analytics surface falls back to.
 *
 * Analytics here is derived from real submissions, so "nothing yet" is a normal
 * state, not an error — it must say *what would make data appear* rather than
 * rendering a chart full of zeroes (plan §5, "never fabricate").
 */
export function AnalyticsEmptyState({ icon: Icon, title, description, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-6 text-muted-foreground" /> : null}
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

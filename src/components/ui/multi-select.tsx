"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string; count?: number };

/**
 * Compact multi-select filter dropdown (checkbox list in a popover). An empty
 * selection means "all". Used for the CBT cluster/file filter and the Origin
 * Question Bag subject filter so both read as the same control.
 */
export function MultiSelectDropdown({
  options,
  selected,
  onChange,
  allLabel = "All",
  buttonClassName,
  contentClassName,
}: {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  allLabel?: string;
  buttonClassName?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  function toggle(value: string) {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange([...next]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold focus:outline-none",
            buttonClassName,
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("max-h-72 w-64 overflow-y-auto p-1", contentClassName)}>
        <button
          type="button"
          onClick={() => onChange([])}
          className={cn(
            "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent",
            selected.length === 0 && "font-bold text-primary",
          )}
        >
          {allLabel}
        </button>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
          >
            <Checkbox checked={selectedSet.has(o.value)} onCheckedChange={() => toggle(o.value)} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count != null ? <span className="shrink-0 text-muted-foreground">{o.count}</span> : null}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

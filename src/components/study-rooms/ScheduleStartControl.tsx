'use client';

import { useState } from 'react';
import { CalendarClock, Check, X } from 'lucide-react';
import { toast } from 'sonner';

/** ISO string → the `yyyy-MM-ddTHH:mm` value a datetime-local input expects (local time). */
function toLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Host control to schedule / edit / clear the room's auto-start time. When the
 * scheduled time is reached the room flips to the test automatically for everyone.
 */
export function ScheduleStartControl({
  scheduledStartAt,
  disabled,
  onSchedule,
}: {
  scheduledStartAt: string | null;
  disabled: boolean;
  onSchedule: (scheduledStartAt: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string>(() => toLocalInputValue(scheduledStartAt));
  const [busy, setBusy] = useState(false);

  const run = async (iso: string | null, success: string): Promise<void> => {
    setBusy(true);
    try {
      await onSchedule(iso);
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update the schedule.');
    } finally {
      setBusy(false);
    }
  };

  const save = (): void => {
    if (!value) {
      toast.error('Pick a date and time first.');
      return;
    }
    const ts = new Date(value);
    if (Number.isNaN(ts.getTime())) {
      toast.error('Invalid date/time.');
      return;
    }
    void run(ts.toISOString(), 'Start time scheduled.');
  };

  return (
    <section className="neu-raised rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <CalendarClock className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">
          Schedule Start
        </h2>
      </div>

      <input
        type="datetime-local"
        value={value}
        disabled={disabled || busy}
        onChange={(event) => setValue(event.target.value)}
        className="w-full neu-inset rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none disabled:opacity-50"
      />

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={disabled || busy || !value}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Check className="h-3.5 w-3.5" />
          {scheduledStartAt ? 'Update' : 'Set'}
        </button>
        {scheduledStartAt && (
          <button
            type="button"
            onClick={() => run(null, 'Schedule cleared.')}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl neu-raised px-3 py-2 text-xs font-bold text-muted-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        At the scheduled time the test starts automatically for everyone. You can still start early with the Start button.
      </p>
    </section>
  );
}

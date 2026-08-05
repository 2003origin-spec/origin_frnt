'use client';

import { Sparkles } from 'lucide-react';
import { useOriHidden, setOriHidden } from '@/lib/ori-visibility';
import { cn } from '@/lib/utils';

/**
 * Profile settings row to show / hide the floating Ori assistant. Mirrors the
 * long-press "Hide Ori" action — both write the same preference, so toggling
 * here restores (or hides) the mascot instantly everywhere.
 */
export default function OriSettingsCard() {
  const hidden = useOriHidden();
  const shown = !hidden;

  return (
    <div className="neu-raised flex items-center gap-4 p-4 rounded-2xl">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-sm text-foreground leading-tight">Ori Assistant</p>
        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
          Show the floating Ori button. Tip: hold Ori for 3s to move it, 4s to hide it.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={shown}
        onClick={() => setOriHidden(shown)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          shown ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
        aria-label={shown ? 'Hide Ori assistant' : 'Show Ori assistant'}
      >
        <span
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
            shown ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

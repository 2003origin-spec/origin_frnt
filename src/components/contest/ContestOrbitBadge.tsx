'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getMyOrbitAction } from '@/server/actions/contest-actions';

/**
 * Persistent ORBIT rating badge for the dashboard — keeps the competitive hook
 * visible BETWEEN contests (the rating was previously only on the result page).
 * Self-hides for non-participants (no rating) or when the flag is off. Taps
 * through to the full /contest/me profile.
 */

function tierAccent(tier: string): string {
  const map: Record<string, string> = {
    Explorer: '#94a3b8', Challenger: '#38bdf8', Contender: '#22d3ee', Advanced: '#34d399',
    Expert: '#a78bfa', Elite: '#f472b6', Master: '#fb923c', 'Origin Legend': '#fbbf24',
  };
  return map[tier] ?? '#3b82f6';
}

export function ContestOrbitBadge() {
  const router = useRouter();
  const [o, setO] = useState<{ rating: number; tier: string; provisional: boolean; ratingChange: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMyOrbitAction().then((r) => { if (!cancelled) setO(r); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!o) return null; // no rating yet / flag off → nothing shown
  const accent = tierAccent(o.tier);
  const up = (o.ratingChange ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={() => router.push('/contest/me')}
      className="w-full neu-raised rounded-2xl p-4 flex items-center gap-4 text-left group"
    >
      <div className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}22` }}>
        <Award className="w-5 h-5" style={{ color: accent }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Your ORBIT</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black tabular-nums" style={{ color: accent }}>{o.rating}</span>
          <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: accent }}>
            {o.tier}{o.provisional ? ' · prov' : ''}
          </span>
          {o.ratingChange != null && o.ratingChange !== 0 && (
            <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-black', up ? 'text-emerald-500' : 'text-rose-500')}>
              {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {up ? '+' : ''}{o.ratingChange}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}

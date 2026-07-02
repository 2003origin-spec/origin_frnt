'use client';

/**
 * Debounced filter bar for the server-rendered /admin/workspaces table.
 * Typing updates the URL query param only after the user pauses (300ms), so the
 * server re-renders once per pause — smooth search-as-you-type without hitting
 * the server on every keystroke. Selects apply immediately.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

type Props = {
  initialQuery: string;
  initialType: string;
  initialStatus: string;
};

export function AdminWorkspacesFilter({ initialQuery, initialType, initialStatus }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState(initialType);
  const [status, setStatus] = useState(initialStatus);

  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  // Skip the navigation on first mount (the server already rendered this state).
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('query', debouncedQuery);
    if (type) params.set('workspaceType', type);
    if (status) params.set('status', status);
    const qs = params.toString();
    router.replace(qs ? `/admin/workspaces?${qs}` : '/admin/workspaces', { scroll: false });
  }, [debouncedQuery, type, status, router]);

  const pending = query.trim() !== debouncedQuery;

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 flex-1 min-w-[220px] rounded-md border bg-background px-3 py-2 focus-within:border-emerald-500/50 transition-colors">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or owner…"
          className="w-full bg-transparent outline-none text-sm"
        />
        {pending && <span className="w-3.5 h-3.5 border-2 border-muted-foreground/40 border-t-transparent rounded-full animate-spin shrink-0" />}
      </div>
      <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="">All types</option>
        <option value="personal">Personal</option>
        <option value="institute">Institute</option>
      </select>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>
  );
}

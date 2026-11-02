'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { announceMessagesChanged, fetchBlocked, unblock } from '@/features/messaging/client';
import type { BlockedPerson } from '@/features/messaging/types';
import { formatISTDayDMY } from '@/lib/format-time';

import { PersonAvatar } from './parts';

/** The students I blocked, each with Unblock (addendum 02/11/2026). */
export default function BlockedStudentsDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [people, setPeople] = useState<BlockedPerson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchBlocked();
    if (res.ok) setPeople(res.data.people ?? []);
    else {
      setPeople([]);
      setError(res.error.detail ?? 'That didn’t load.');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      setPeople(null);
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, load]);

  async function onUnblock(p: BlockedPerson) {
    setBusyId(p.person.id);
    const res = await unblock(p.person.id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(res.error.detail ?? 'Couldn’t unblock. Try again.');
      return;
    }
    toast.success(`Unblocked ${p.person.name}.`);
    setPeople((list) => (list ?? []).filter((x) => x.person.id !== p.person.id));
    announceMessagesChanged();
    onChanged?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Blocked students</DialogTitle>
          <DialogDescription>
            Neither of you can message the other. Unblocking doesn&apos;t tell them.
          </DialogDescription>
        </DialogHeader>
        {people === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{error}</p>
        ) : people.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
            {people.map((p) => (
              <li key={p.person.id} className="flex items-center gap-3 py-3">
                <PersonAvatar person={p.person} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.person.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.person.username ? `@${p.person.username} · ` : ''}Blocked {formatISTDayDMY(p.blockedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.person.id}
                  onClick={() => void onUnblock(p)}
                  className="font-bold"
                >
                  {busyId === p.person.id ? <Loader2 className="size-4 animate-spin" /> : 'Unblock'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

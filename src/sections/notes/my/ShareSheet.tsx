'use client';

/**
 * My Notes — share a file or folder with mutual friends (students who follow
 * me and whom I follow back). Shows who already has it, with Remove.
 * V1/NOTES_PLAN.md §9.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Loader2, Search, Users } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import type { ShareFriend, ShareTargetType } from '@/lib/notes/my-types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { notesSend, useNotesQuery } from '../notes-client';

export type ShareTarget = { type: ShareTargetType; id: string; title: string };

const buttonBase = 'inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-60';

export function FriendAvatar({ name, avatar, size = 'h-11 w-11' }: { name: string; avatar: string | null; size?: string }) {
  return (
    <Avatar className={cn(size, 'shrink-0')}>
      {avatar ? <AvatarImage src={avatar} alt="" className="object-cover" /> : null}
      <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">{name.charAt(0).toUpperCase() || '?'}</AvatarFallback>
    </Avatar>
  );
}

export function ShareSheet({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: ShareTarget }) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const path = `friends?targetType=${target.type}&targetId=${encodeURIComponent(target.id)}${debounced ? `&q=${encodeURIComponent(debounced)}` : ''}`;
  const { data, error: loadError, loading, reload } = useNotesQuery<{ friends: ShareFriend[] }>(open ? path : null);
  const friends = data?.friends ?? [];
  const sharedCount = friends.filter((friend) => friend.shareId).length;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const share = async () => {
    if (picked.size === 0) return;
    setBusy('share');
    setError(null);
    try {
      await notesSend('shares', 'POST', { targetType: target.type, targetId: target.id, recipientIds: [...picked] });
      toast.success(picked.size === 1 ? 'Shared with 1 friend' : `Shared with ${picked.size} friends`);
      setPicked(new Set());
      reload();
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not share. Try again.');
    } finally {
      setBusy(null);
    }
  };

  const unshare = async (friend: ShareFriend) => {
    if (!friend.shareId) return;
    setBusy(friend.id);
    setError(null);
    try {
      await notesSend(`shares/${encodeURIComponent(friend.shareId)}`, 'DELETE');
      toast.success(`${friend.name} can't see it any more`);
      reload();
    } catch (err) {
      setError((err as { message?: string }).message ?? 'Could not remove. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Don't focus the search box on open: on a phone the keyboard would cover the friends list. */}
      <DialogContent className="flex max-h-[90dvh] max-w-md flex-col" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="break-words">Share “{target.title}”</DialogTitle>
          <DialogDescription>
            {target.type === 'folder'
              ? 'Friends can open and download everything in this folder, including files you add later. They can’t change anything.'
              : 'Friends can open and download it. They can’t change it.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search friends"
            aria-label="Search friends"
            className="h-12 w-full rounded-xl border border-border bg-surface-1 pl-10 pr-3 text-[15px] outline-none focus:border-primary"
          />
        </div>

        <div className="-mx-1 mt-3 min-h-32 flex-1 overflow-y-auto px-1">
          {loading && !data ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading friends" />
            </div>
          ) : loadError ? (
            <p role="alert" className="py-6 text-center text-sm text-destructive">
              {loadError.message}
            </p>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Users className="h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="text-[15px] font-semibold">{debounced ? `No friend named "${debounced}"` : 'No friends to share with yet'}</p>
              {!debounced && (
                <p className="text-sm text-muted-foreground">
                  You can share with students you follow who follow you back.{' '}
                  <Link href="/social" className="font-semibold text-primary underline underline-offset-2">
                    Find friends
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <ul className="space-y-1" aria-label="Friends">
              {friends.map((friend) => {
                const checked = picked.has(friend.id);
                return (
                  <li key={friend.id} className="flex min-h-14 items-center gap-3 rounded-xl px-2">
                    <FriendAvatar name={friend.name} avatar={friend.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{friend.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {friend.username ? `@${friend.username}` : ''}
                        {friend.shareId ? ' · Has access' : ''}
                      </span>
                    </span>
                    {friend.shareId ? (
                      <button
                        type="button"
                        onClick={() => unshare(friend)}
                        disabled={busy !== null}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
                        aria-label={`Stop sharing with ${friend.name}`}
                      >
                        {busy === friend.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => toggle(friend.id)}
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2',
                          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-surface-2',
                        )}
                        aria-label={`Share with ${friend.name}`}
                      >
                        {checked && <Check className="h-5 w-5" aria-hidden />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {sharedCount > 0 && <p className="mt-2 text-sm text-muted-foreground">{sharedCount === 1 ? '1 friend has access.' : `${sharedCount} friends have access.`}</p>}
        <DialogFooter className="mt-3 gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className={cn(buttonBase, 'border border-border hover:bg-surface-2')}>
            Done
          </button>
          <button type="button" onClick={share} disabled={picked.size === 0 || busy !== null} className={cn(buttonBase, 'bg-primary text-primary-foreground')}>
            {busy === 'share' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {picked.size > 1 ? `Share with ${picked.size}` : 'Share'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

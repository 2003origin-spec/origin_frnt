export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getServerUser } from '@/lib/auth-server';
import { listUserBookmarks } from '@/server/contest/contest-bookmark-service';
import { LatexRenderer } from '@/components/ui/LatexRenderer';

export default async function ContestBookmarksPage() {
  if (!isFeatureEnabled('contest')) notFound();
  const user = await getServerUser();
  if (!user) redirect('/auth?next=/contest/bookmarks');
  let bookmarks: Awaited<ReturnType<typeof listUserBookmarks>> = [];
  try {
    bookmarks = await listUserBookmarks(user.id);
  } catch (err) {
    console.error('[contest/bookmarks] failed:', err);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold text-foreground">Saved contest questions</h1>
      {bookmarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved questions yet. Star a question in any contest review to save it here.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookmarks.map((b) => {
            const text = String((b.snapshot?.text as string) ?? '');
            const subject = (b.snapshot?.subject as string) ?? null;
            const chapter = (b.snapshot?.chapter as string) ?? null;
            return (
              <li key={`${b.contestId}:${b.position}`} className="neu-raised rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                  {subject ?? 'Question'}{chapter ? ` · ${chapter}` : ''}
                </div>
                <div className="text-sm font-medium text-foreground"><LatexRenderer content={text} /></div>
                <Link href={`/contest/${b.contestId}/attempt-review`} className="mt-2 inline-block text-xs text-muted-foreground hover:text-primary">
                  View in contest review →
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

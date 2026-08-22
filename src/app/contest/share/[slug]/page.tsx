import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { isFeatureEnabled } from '@/lib/feature-flags';
import { getPublicShareCard } from '@/server/contest/contest-share-service';
import { getCanonicalSiteUrl } from '@/lib/site-url';

/**
 * Public shared-result page (plan Phase 8 growth loop). Unauthenticated + a
 * SANITIZED card (first name, rank, percentile, score, ORBIT) with a
 * "Beat my ORBIT" CTA to the landing. Declared public in route-policy.
 */

export const dynamic = 'force-dynamic';

async function loadCard(slug: string) {
  if (!isFeatureEnabled('contest')) return null;
  try {
    return await getPublicShareCard(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const card = await loadCard(slug);
  if (!card) return { title: 'Origin Weekly Contest', robots: { index: false } };
  const title = `${card.displayName} — ORBIT ${card.orbit?.rating ?? ''} on ${card.contestName}`.trim();
  const description = card.rank
    ? `Rank #${card.rank}${card.percentile != null ? ` · ${card.percentile} percentile` : ''} on Origin Weekly. Think you can beat it?`
    : 'See this result on Origin Weekly — and beat it.';
  const url = `${getCanonicalSiteUrl()}/contest/share/${slug}`;
  return {
    title,
    description,
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: 'Origin', images: ['/origin-new.jpg'], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: ['/origin-new.jpg'] },
  };
}

export default async function ContestSharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await loadCard(slug);
  if (!card) notFound();

  const up = (card.orbitChange ?? 0) >= 0;
  const site = getCanonicalSiteUrl();

  return (
    <div className="min-h-dvh neu-surface flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md neu-raised rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-widest text-primary">Origin Weekly</div>
          <h1 className="text-2xl font-black text-foreground mt-1">{card.contestName}</h1>
          <p className="text-sm font-bold text-muted-foreground mt-1">{card.displayName}&apos;s result</p>
        </div>

        {card.orbit && (
          <div className="neu-inset rounded-2xl p-5 text-center">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ORBIT</div>
            <div className="flex items-baseline justify-center gap-2 mt-1">
              <span className="text-5xl font-black text-primary tabular-nums">{card.orbit.rating}</span>
              {card.orbitChange != null && (
                <span className={up ? 'text-emerald-500 font-black' : 'text-rose-500 font-black'}>
                  {up ? '▲ +' : '▼ '}{card.orbitChange}
                </span>
              )}
            </div>
            <div className="text-[11px] font-black uppercase tracking-wide text-primary mt-1">
              {card.orbit.tier}{card.orbit.provisional ? ' · provisional' : ''}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Rank" value={card.rank != null ? `#${card.rank}` : '—'} sub={card.totalRanked ? `of ${card.totalRanked}` : ''} />
          <Stat label="Percentile" value={card.percentile != null ? `${card.percentile}` : '—'} />
          <Stat label="Score" value={card.score != null ? `${card.score}` : '—'} />
        </div>

        <div className="text-center space-y-3 pt-1">
          <div className="text-base font-black text-foreground">Think you can beat this ORBIT?</div>
          <Link
            href={site}
            className="inline-flex items-center justify-center w-full h-12 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-xs"
          >
            Join the next Origin Weekly
          </Link>
          <div className="text-[11px] font-bold text-muted-foreground">Free · JEE &amp; NEET · o3origin.com</div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="neu-inset rounded-2xl p-3 text-center">
      <div className="text-lg font-black text-foreground tabular-nums">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      {sub && <div className="text-[9px] font-bold text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

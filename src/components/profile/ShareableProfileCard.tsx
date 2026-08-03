'use client';

import { useCallback, useEffect, useState } from 'react';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { Share2, Download, MessageCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { saveFileNative } from '@/native/save-file';
import { apiCall } from '@/lib/api';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { MILESTONE_BADGES } from '@/lib/milestone-badges';
import { STREAK_BADGES } from '@/lib/streak-badges';

const PUBLIC_SITE_URL = getCanonicalSiteUrl();

interface ShareableProfileCardProps {
  open: boolean;
  onClose: () => void;
  name: string;
  currentStreak: number;
  longestStreak: number;
  totalSolved: number;
}

/**
 * One-tap shareable "flex" card of a student's profile (streak, solved, rank,
 * earned badges) — the LeetCode-flex loop from the retention brief. Reuses the
 * proven toPng → Web Share / native-download pipeline.
 */
export default function ShareableProfileCard({ open, onClose, name, currentStreak, longestStreak, totalSolved }: ShareableProfileCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [rank, setRank] = useState<number | null>(null);

  const earnedMilestones = MILESTONE_BADGES.filter((m) => totalSolved >= m.solved);
  const earnedStreaks = STREAK_BADGES.filter((b) => longestStreak >= b.days);
  const badgeSrcs = [...earnedStreaks.map((b) => b.src), ...earnedMilestones.map((m) => m.src)].slice(0, 5);
  const shareText = `${name} on ORIGIN AI 🔥 ${currentStreak}-day streak · ${totalSolved.toLocaleString('en-IN')} solved${rank ? ` · Rank #${rank}` : ''}.\n\nBeat me → ${PUBLIC_SITE_URL}`;

  const cardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // Snapshot after two paints so the badge images are laid out.
    (async () => {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      try {
        setImageUrl(await toPng(node, { quality: 0.95, pixelRatio: 2, cacheBust: true }));
      } catch {
        /* keep spinner */
      }
    })();
  }, [name, currentStreak, longestStreak, totalSolved, rank]);

  useEffect(() => {
    if (!open) return;
    setImageUrl(null);
    apiCall('/assessments/ogcode/championship/', { silentAuth: true })
      .then((d) => setRank((d as { myRank: number | null })?.myRank ?? null))
      .catch(() => setRank(null));
  }, [open]);

  const handleShare = useCallback(
    async (platform?: 'whatsapp') => {
      if (!imageUrl) return;
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `Origin_Profile_${Date.now()}.png`, { type: 'image/png' });
        const data: ShareData = { files: [file], title: 'My ORIGIN AI profile', text: shareText };
        if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(data)) {
          await navigator.share(data);
        } else if (platform === 'whatsapp') {
          window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
        } else {
          await navigator.clipboard.writeText(shareText);
          toast.success('Copied — paste it anywhere to flex.');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
      }
    },
    [imageUrl, shareText],
  );

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    const fileName = `Origin_Profile_${name.replace(/[^\w-]+/g, '_') || 'Scholar'}_${Date.now()}.png`;
    if (await saveFileNative(fileName, 'image/png', imageUrl)) {
      toast.success('Saved to your Downloads.');
      return;
    }
    download(imageUrl, fileName);
  }, [imageUrl, name]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="relative w-full max-w-sm rounded-3xl bg-[hsl(var(--neu-bg))] border border-border/40 shadow-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 z-10 rounded-full bg-black/5 dark:bg-white/10 p-2 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/20 transition" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-base font-black text-foreground mb-3 pr-8">Flex your profile</h2>

        <div className="rounded-2xl overflow-hidden border border-border/40 bg-slate-100 dark:bg-slate-900 aspect-[4/5] flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Your profile card" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Creating your card…</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={() => void handleShare('whatsapp')} disabled={!imageUrl} className="h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C4B] dark:text-[#25D366] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:bg-[#25D366]/20">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button onClick={() => void handleShare()} disabled={!imageUrl} className="h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90 shadow-lg shadow-primary/20">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        <button onClick={() => void handleDownload()} disabled={!imageUrl} className="mt-3 w-full h-12 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/40 text-foreground font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:bg-black/10 dark:hover:bg-white/10">
          <Download className="w-4 h-4" /> Download
        </button>

        {/* ── Off-screen branded card ─────────────────────────────────── */}
        <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden="true">
          <div ref={cardRef} style={{ width: '540px', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', background: 'linear-gradient(160deg, #0b1220 0%, #0f172a 55%, #111827 100%)', color: '#fff', padding: '44px 40px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '320px', height: '320px', borderRadius: '9999px', background: '#f97316', opacity: 0.16, filter: 'blur(70px)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/origin-new.jpg" alt="" style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover', border: '2px solid #f59e0b' }} />
              <div>
                <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>ORIGIN AI</div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase' }}>Scholar Card</div>
              </div>
            </div>

            <div style={{ marginTop: '30px', fontSize: '30px', fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '460px', position: 'relative' }}>{name}</div>

            <div style={{ marginTop: '22px', display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
              <span style={{ fontSize: '52px', lineHeight: 1 }}>🔥</span>
              <div>
                <div style={{ fontSize: '48px', fontWeight: 900, color: '#fb923c', lineHeight: 1 }}>{currentStreak}</div>
                <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.16em', color: '#94a3b8', textTransform: 'uppercase' }}>Day Streak</div>
              </div>
            </div>

            <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', position: 'relative' }}>
              {[
                { k: 'Solved', v: totalSolved.toLocaleString('en-IN') },
                { k: 'Rank', v: rank ? `#${rank}` : '—' },
                { k: 'Best', v: `${longestStreak}d` },
              ].map((s) => (
                <div key={s.k} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#e2e8f0', lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginTop: '6px', textTransform: 'uppercase' }}>{s.k}</div>
                </div>
              ))}
            </div>

            {badgeSrcs.length > 0 && (
              <div style={{ marginTop: '26px', display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'relative' }}>
                {badgeSrcs.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" style={{ width: '58px', height: '58px', objectFit: 'contain' }} />
                ))}
              </div>
            )}

            <div style={{ marginTop: '30px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>o3origin.com</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Best AI prep for JEE · NEET</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

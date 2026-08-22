'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { Share2, Download, MessageCircle, Loader2, X, Twitter, Send, Check, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

import { shareImage, saveImage, type ShareTarget } from '@/lib/share';
import { getCanonicalSiteUrl } from '@/lib/site-url';
import { track } from '@/lib/analytics';
import { mutateJson } from '@/lib/csrf';

/**
 * Contest-specific share card (plan Phase 8 — growth loop). Unlike the generic
 * ShareableReportCard, the HERO is the ORBIT rating + tier + movement and the
 * rank — the things that make a competitive result worth flexing — and the
 * share text is a "Beat my ORBIT" invite carrying a deep link back to the
 * contest so a friend can join the next one.
 *
 * Reuses the proven capture pipeline: an off-screen fixed-size card →
 * html-to-image `toPng` → Web Share (WhatsApp/clipboard fallback) / download.
 */

const PUBLIC_SITE_URL = getCanonicalSiteUrl();

export interface ContestShareCardProps {
  open: boolean;
  onClose: () => void;
  contestId: string;
  studentName: string;
  contestName: string;
  orbit: { rating: number; tier: string; provisional: boolean };
  movement: { change: number } | null;
  rank: number | null;
  totalRanked: number | null;
  percentile: number | null;
  score: number | null;
  accuracy: number | null;
  /** Landing fallback if the public share slug can't be minted. */
  shareUrl?: string;
}

// Tier → accent colour (mirrors the 8 ORBIT tiers, warm→cool as rating climbs).
function tierAccent(tier: string): string {
  const map: Record<string, string> = {
    Explorer: '#94a3b8',
    Challenger: '#38bdf8',
    Contender: '#22d3ee',
    Advanced: '#34d399',
    Expert: '#a78bfa',
    Elite: '#f472b6',
    Master: '#fb923c',
    'Origin Legend': '#fbbf24',
  };
  return map[tier] ?? '#3b82f6';
}

export default function ContestShareCard({
  open,
  onClose,
  contestId,
  studentName,
  contestName,
  orbit,
  movement,
  rank,
  totalRanked,
  percentile,
  score,
  accuracy,
  shareUrl,
}: ContestShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slugUrl, setSlugUrl] = useState<string | null>(null);

  const accent = tierAccent(orbit.tier);
  const up = (movement?.change ?? 0) >= 0;
  // Prefer the public, sanitized share page (minted on open); fall back to the
  // landing so a mint failure never breaks sharing.
  const deepLink = slugUrl || shareUrl || PUBLIC_SITE_URL;

  // Mint the opt-in public share slug when the sheet opens (idempotent server-side).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void mutateJson('/api/contest/share', { method: 'POST', body: JSON.stringify({ contestId }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!cancelled && b?.slug) setSlugUrl(`${PUBLIC_SITE_URL}/contest/share/${b.slug}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, contestId]);

  const generate = useCallback(async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const dataUrl = await toPng(cardRef.current, { quality: 0.95, pixelRatio: 2, cacheBust: true });
      setImageUrl(dataUrl);
    } catch (err) {
      console.error('Contest share card generation failed:', err);
      toast.error('Could not create the image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setImageUrl(null);
      void generate();
    }
  }, [open, generate]);

  const fileName = `Origin_ORBIT_${studentName.replace(/[^\w-]+/g, '_') || 'Scholar'}_${orbit.rating}.png`;

  const shareText =
    `${studentName} climbed to ORBIT ${orbit.rating} (${orbit.tier})` +
    (rank ? ` · Rank #${rank}` : '') +
    ` on ${contestName} 🚀\n\nThink you can beat my ORBIT? Join the next Origin Weekly: ${deepLink}`;

  const handleShare = useCallback(
    async (target?: ShareTarget) => {
      if (!imageUrl) return;
      track('contest_share', { channel: target ?? 'native', tier: orbit.tier });
      const result = await shareImage({ imageUrl, fileName, title: 'My ORBIT on Origin Weekly', text: shareText, target });
      if (result === 'downloaded') {
        toast.success(target ? 'Image saved — attach it in the chat that just opened.' : 'Image saved to your device.');
      }
    },
    [imageUrl, fileName, shareText, orbit.tier],
  );

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    track('contest_share', { channel: 'download', tier: orbit.tier });
    await saveImage(imageUrl, fileName);
    toast.success('Saved to your device.');
  }, [imageUrl, fileName, orbit.tier]);

  const [copied, setCopied] = useState(false);
  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      track('contest_share', { channel: 'copy_link', tier: orbit.tier });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link.');
    }
  }, [deepLink, orbit.tier]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share your ORBIT result"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[hsl(var(--neu-bg))] border border-border/40 shadow-2xl p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/5 dark:bg-white/10 p-2 text-muted-foreground hover:bg-black/10 dark:hover:bg-white/20 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-base font-black text-foreground mb-3 pr-8">Flex your ORBIT</h2>

        <div className="rounded-2xl overflow-hidden border border-border/40 bg-slate-100 dark:bg-slate-900 aspect-[4/5] flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Your ORBIT result card" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Creating your card…</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => void handleShare('whatsapp')}
            disabled={!imageUrl || isGenerating}
            className="h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#128C4B] dark:text-[#25D366] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:bg-[#25D366]/20"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button
            onClick={() => void handleShare()}
            disabled={!imageUrl || isGenerating}
            className="h-12 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90 shadow-lg shadow-primary/20"
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
        {/* Secondary intents — X / Telegram / Copy link */}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <button
            onClick={() => void handleShare('twitter')}
            disabled={!imageUrl || isGenerating}
            className="h-11 rounded-2xl neu-raised text-foreground font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Twitter className="w-4 h-4" /> X
          </button>
          <button
            onClick={() => void handleShare('telegram')}
            disabled={!imageUrl || isGenerating}
            className="h-11 rounded-2xl neu-raised text-foreground font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> Telegram
          </button>
          <button
            onClick={copyLink}
            disabled={isGenerating}
            className="h-11 rounded-2xl neu-raised text-foreground font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />} {copied ? 'Copied' : 'Link'}
          </button>
        </div>
        <button
          onClick={() => void handleDownload()}
          disabled={!imageUrl || isGenerating}
          className="mt-3 w-full h-12 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/40 text-foreground font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition hover:bg-black/10 dark:hover:bg-white/10"
        >
          <Download className="w-4 h-4" /> Download
        </button>

        {/* ── Off-screen branded card template (the capture source) ───────── */}
        <div className="absolute left-[-9999px] top-0 pointer-events-none" aria-hidden="true">
          <div
            ref={cardRef}
            style={{
              width: '540px',
              fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
              background: 'linear-gradient(160deg, #0b1220 0%, #0f172a 55%, #111827 100%)',
              color: '#ffffff',
              padding: '44px 40px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-120px',
                right: '-120px',
                width: '340px',
                height: '340px',
                borderRadius: '9999px',
                background: accent,
                opacity: 0.2,
                filter: 'blur(72px)',
              }}
            />

            {/* Header: logo + wordmark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/origin-new.jpg"
                alt=""
                style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover', border: `2px solid ${accent}` }}
              />
              <div>
                <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>ORIGIN WEEKLY</div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase' }}>
                  ORBIT Rating
                </div>
              </div>
            </div>

            {/* Student + contest */}
            <div style={{ marginTop: '26px', position: 'relative' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '460px' }}>
                {studentName}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#cbd5e1', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '460px' }}>
                {contestName}
              </div>
            </div>

            {/* ORBIT hero */}
            <div style={{ marginTop: '26px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.18em', color: '#94a3b8', textTransform: 'uppercase' }}>ORBIT</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
                  <span style={{ fontSize: '76px', fontWeight: 900, lineHeight: 1, color: accent }}>{orbit.rating}</span>
                  {movement && (
                    <span style={{ fontSize: '24px', fontWeight: 900, color: up ? '#34d399' : '#f87171' }}>
                      {up ? '▲ +' : '▼ '}
                      {movement.change}
                    </span>
                  )}
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '6px 16px', borderRadius: '9999px', background: `${accent}22`, border: `1px solid ${accent}55` }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{orbit.tier}</span>
                  {orbit.provisional && <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>provisional</span>}
                </div>
              </div>
            </div>

            {/* Rank / percentile / score row */}
            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', position: 'relative' }}>
              {[
                { k: 'Rank', v: rank ? `#${rank}` : '—', s: totalRanked ? `of ${totalRanked}` : '' },
                { k: 'Percentile', v: percentile != null ? `${percentile}` : '—', s: '' },
                { k: 'Score', v: score != null ? `${score}` : '—', s: accuracy != null ? `${accuracy}% acc` : '' },
              ].map((t) => (
                <div key={t.k} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 900, color: '#e2e8f0', lineHeight: 1 }}>{t.v}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginTop: '6px', textTransform: 'uppercase' }}>{t.k}</div>
                  {t.s && <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', marginTop: '2px' }}>{t.s}</div>}
                </div>
              ))}
            </div>

            {/* "Beat my ORBIT" CTA */}
            <div
              style={{
                marginTop: '26px',
                padding: '16px 18px',
                borderRadius: '18px',
                background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`,
                border: `1px solid ${accent}44`,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '26px' }}>🏆</span>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>Think you can beat my ORBIT?</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginTop: '2px' }}>Join the next Origin Weekly and find out.</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>o3origin.com</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>Best AI prep for JEE · NEET</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

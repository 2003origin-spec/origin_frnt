'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import download from 'downloadjs';
import { Share2, Download, MessageCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { saveFileNative } from '@/native/save-file';
import { getCanonicalSiteUrl } from '@/lib/site-url';

const PUBLIC_SITE_URL = getCanonicalSiteUrl();

export interface ReportCardStats {
  score: number;
  totalMarks: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
}

interface ShareableReportCardProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  testName: string;
  dateLabel: string;
  stats: ReportCardStats;
  /** Optional per-subject breakdown rows for the card. */
  subjects?: Array<{ name: string; score: number; totalMarks: number; accuracy: number }>;
}

// Performance band → mascot + label + accent. Mascots live in /public/ori2d.
function band(accuracy: number): { mascot: string; label: string; accent: string } {
  if (accuracy >= 80) return { mascot: '/ori2d/ori-proud.png', label: 'Excellent work!', accent: '#10b981' };
  if (accuracy >= 50) return { mascot: '/ori2d/ori-cheerful.png', label: 'Good going!', accent: '#3b82f6' };
  return { mascot: '/ori2d/ori-determined.png', label: 'Keep pushing!', accent: '#f59e0b' };
}

const SHARE_TEXT = (name: string, score: number, total: number) =>
  `${name} scored ${score}/${total} on ORIGIN AI 🎯\n\nThe best AI prep platform for JEE/NEET. Join here: ${PUBLIC_SITE_URL}`;

/**
 * Renders a branded, shareable image of a test result. Reuses the proven
 * PhotoBooth pipeline: an off-screen fixed-size card → html-to-image `toPng`
 * → Web Share (with WhatsApp/clipboard fallback) / native-or-browser download.
 */
export default function ShareableReportCard({
  open,
  onClose,
  studentName,
  testName,
  dateLabel,
  stats,
  subjects = [],
}: ShareableReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { mascot, label, accent } = band(stats.accuracy);
  const attempted = stats.correct + stats.incorrect;

  const generate = useCallback(async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      // Two RAFs so the template + its images are painted before snapshot.
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
      });
      setImageUrl(dataUrl);
    } catch (err) {
      console.error('Report card generation failed:', err);
      toast.error('Could not create the image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // Generate once each time the dialog opens.
  useEffect(() => {
    if (open) {
      setImageUrl(null);
      void generate();
    }
  }, [open, generate]);

  const handleShare = useCallback(
    async (platform?: 'whatsapp') => {
      if (!imageUrl) return;
      const message = SHARE_TEXT(studentName, stats.score, stats.totalMarks);
      try {
        const blob = await (await fetch(imageUrl)).blob();
        const file = new File([blob], `Origin_Report_${Date.now()}.png`, { type: 'image/png' });
        const shareData: ShareData = { files: [file], title: 'My ORIGIN AI Report Card', text: message };
        const canShareFile =
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare(shareData);
        if (canShareFile) {
          await navigator.share(shareData);
        } else if (platform === 'whatsapp') {
          window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
        } else {
          await navigator.clipboard.writeText(message);
          toast.success('Message copied — paste it anywhere to share.');
        }
      } catch (err) {
        // User-cancelled share throws AbortError — ignore it silently.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      }
    },
    [imageUrl, studentName, stats.score, stats.totalMarks],
  );

  const handleDownload = useCallback(async () => {
    if (!imageUrl) return;
    const fileName = `Origin_Report_${studentName.replace(/[^\w-]+/g, '_') || 'Scholar'}_${Date.now()}.png`;
    // Android shell: blob/dataURL downloads no-op in a WebView — use the bridge.
    if (await saveFileNative(fileName, 'image/png', imageUrl)) {
      toast.success('Saved to your Downloads.');
      return;
    }
    download(imageUrl, fileName);
  }, [imageUrl, studentName]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share your report card"
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

        <h2 className="text-base font-black text-foreground mb-3 pr-8">Share your result</h2>

        {/* On-screen preview (the generated image, or a spinner while rendering) */}
        <div className="rounded-2xl overflow-hidden border border-border/40 bg-slate-100 dark:bg-slate-900 aspect-[4/5] flex items-center justify-center">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Your report card" className="w-full h-full object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest">Creating your card…</p>
            </div>
          )}
        </div>

        {/* Actions */}
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
            {/* Accent glow */}
            <div
              style={{
                position: 'absolute',
                top: '-120px',
                right: '-120px',
                width: '320px',
                height: '320px',
                borderRadius: '9999px',
                background: accent,
                opacity: 0.18,
                filter: 'blur(70px)',
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
                <div style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>ORIGIN AI</div>
                <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.22em', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase' }}>
                  Report Card
                </div>
              </div>
            </div>

            {/* Student + test */}
            <div style={{ marginTop: '30px', position: 'relative' }}>
              <div style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '460px' }}>
                {studentName}
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#cbd5e1', marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '460px' }}>
                {testName}
              </div>
              {dateLabel && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginTop: '3px' }}>{dateLabel}</div>
              )}
            </div>

            {/* Score hero */}
            <div style={{ marginTop: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.18em', color: '#94a3b8', textTransform: 'uppercase' }}>Score</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                  <span style={{ fontSize: '68px', fontWeight: 900, lineHeight: 1, color: accent }}>{stats.score}</span>
                  <span style={{ fontSize: '28px', fontWeight: 800, color: '#94a3b8' }}>/ {stats.totalMarks}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '14px', padding: '6px 14px', borderRadius: '9999px', background: `${accent}22`, border: `1px solid ${accent}55` }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: accent }}>{stats.accuracy}%</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>accuracy · {label}</span>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mascot} alt="" style={{ width: '104px', height: '104px', objectFit: 'contain' }} />
            </div>

            {/* Stat row */}
            <div style={{ marginTop: '30px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', position: 'relative' }}>
              {[
                { k: 'Attempted', v: attempted, c: '#e2e8f0' },
                { k: 'Correct', v: stats.correct, c: '#34d399' },
                { k: 'Wrong', v: stats.incorrect, c: '#f87171' },
                { k: 'Skipped', v: stats.unattempted, c: '#94a3b8' },
              ].map((s) => (
                <div key={s.k} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '14px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', marginTop: '6px', textTransform: 'uppercase' }}>{s.k}</div>
                </div>
              ))}
            </div>

            {/* Optional subject breakdown (max 4 rows) */}
            {subjects.length > 0 && (
              <div style={{ marginTop: '22px', position: 'relative' }}>
                {subjects.slice(0, 4).map((sub) => (
                  <div key={sub.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', textTransform: 'capitalize' }}>{sub.name}</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#cbd5e1' }}>
                      {sub.score}/{sub.totalMarks} · {sub.accuracy}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: '30px', paddingTop: '18px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#e2e8f0' }}>o3origin.com</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>Best AI prep for JEE · NEET</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

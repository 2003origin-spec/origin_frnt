'use client';

import Link from 'next/link';

import type { ContestCertificate as Cert } from '@/server/contest/contest-certificate-service';

/**
 * A printable contest certificate (Phase 6). Default branded design — an SVG
 * card the user can print or screenshot (the viewer can't force a download, so
 * we offer window.print()). No PII beyond the recipient's own name/result.
 */
export function ContestCertificate({ cert }: { cert: Cert }) {
  const date = new Date(cert.issuedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const pctText = cert.percentile != null ? `Top ${Math.max(1, Math.round(100 - cert.percentile))}%` : null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link href={`/contest/${cert.contestId}/result`} className="text-sm text-muted-foreground hover:text-primary">← Result</Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white"
          >
            Print / Save as PDF
          </button>
        </div>

        <div className="rounded-3xl border-4 border-primary/30 bg-white p-8 sm:p-12 text-center shadow-xl print:shadow-none print:border-primary/40">
          <div className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">O3 Origin · Weekly Contest</div>
          <div className="mt-6 text-2xl font-serif text-gray-500">Certificate of Achievement</div>
          <div className="mt-8 text-sm text-gray-500">This certifies that</div>
          <div className="mt-2 text-4xl font-black text-gray-900">{cert.recipientName}</div>
          <div className="mt-6 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            participated in <span className="font-bold text-gray-900">{cert.contestName}</span> and secured
          </div>

          <div className="mt-6 flex items-center justify-center gap-8 flex-wrap">
            <Stat label="Rank" value={cert.rank != null ? `#${cert.rank}` : '—'} sub={cert.totalParticipants ? `of ${cert.totalParticipants}` : undefined} />
            {pctText && <Stat label="Percentile" value={pctText} />}
            <Stat label="Score" value={cert.score != null ? String(cert.score) : '—'} />
          </div>

          <div className="mt-10 flex items-center justify-between text-[11px] text-gray-400">
            <span>Issued {date}</span>
            <span>o3origin.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-black text-primary tabular-nums">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );
}

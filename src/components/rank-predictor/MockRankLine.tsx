'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gauge } from 'lucide-react';

import { apiCall } from '@/lib/api';
import { EXAM_LABEL, mockPreviewText } from '@/lib/rank-predictor/format';
import type { PercentileBand, RankBand, RankPredictorExam } from '@/lib/rank-predictor/types';

type Fill = {
  exam: RankPredictorExam;
  kind: string;
  preview?: { air: RankBand | null; percentile?: PercentileBand | null; topText: string | null } | null;
};

/**
 * One line on a full-length mock result (plan §9.3): "In the real NEET this is
 * about AIR 48k–56k, percentile 97.10 – 98.40 → See details" (no percentile for
 * JEE Advanced, which has none). The server decides whether the attempt is a
 * full mock of an exam (only then is `preview` set); anything else, including
 * an error, renders nothing. Mounted only when the rankPredictor flag is on.
 */
export default function MockRankLine({ resultId }: { resultId: string }) {
  const [loaded, setLoaded] = useState<{ id: string; fill: Fill } | null>(null);

  useEffect(() => {
    let alive = true;
    apiCall(`/assessments/rank-predictor/attempt/${encodeURIComponent(resultId)}`, { silentAuth: true })
      .then((data: Fill) => {
        if (alive) setLoaded({ id: resultId, fill: data });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [resultId]);

  const fill = loaded?.id === resultId ? loaded.fill : null;
  const air = fill?.preview?.air;
  if (!fill || fill.kind !== 'full_mock' || !air) return null;
  const text = mockPreviewText(fill.exam, { air, percentile: fill.preview?.percentile });

  return (
    <Link
      href={`/rank-predictor?attempt=${encodeURIComponent(resultId)}`}
      className="mx-auto mt-4 flex min-h-12 w-full max-w-4xl items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 text-[14px] text-foreground transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <Gauge aria-hidden className="size-5 shrink-0 text-primary" />
      <span className="flex-1">
        In the real {EXAM_LABEL[fill.exam]} this is about <strong className="tabular-nums">{text.rank}</strong>
        {text.percentile ? (
          <>
            , percentile <strong className="tabular-nums">{text.percentile}</strong>
          </>
        ) : null}
        <span className="text-muted-foreground"> (rough, from a mock)</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
        See details <ArrowRight aria-hidden className="size-4" />
      </span>
    </Link>
  );
}

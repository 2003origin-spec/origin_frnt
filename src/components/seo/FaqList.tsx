import type { FaqItem } from '@/lib/seo/rank-predictor-seo';

/**
 * Plain, always-visible FAQ block (no accordion, nothing hidden), so the
 * questions in a page's FAQPage JSON-LD are the questions a reader sees.
 * Server-safe; also fine inside client components (SSR puts it in the HTML).
 */
export function FaqList({ items, heading = 'Questions people ask', headingId }: { items: readonly FaqItem[]; heading?: string; headingId: string }) {
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-[18px] border border-border bg-card p-4 sm:p-6">
      <h2 id={headingId} className="font-display text-[21px] font-bold text-foreground">
        {heading}
      </h2>
      <dl className="flex flex-col gap-4">
        {items.map((item) => (
          <div key={item.question} className="flex flex-col gap-1">
            <dt className="text-[15px] font-semibold text-foreground">{item.question}</dt>
            <dd className="text-[14px] leading-relaxed text-muted-foreground">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

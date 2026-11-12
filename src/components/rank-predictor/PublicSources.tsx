import { PUBLIC_DATA_ACK, SOURCES_ANCHOR_ID, sourceGroups, splitLinks, type SourceLink } from '@/lib/rank-predictor/public-sources';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/**
 * "This data is collected and worked out from publicly available data. Sources"
 * — the word Sources jumps to the list (SourcesSection) lower on the page.
 */
export function PublicDataAck({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[13px] leading-relaxed text-muted-foreground ${className}`}>
      {PUBLIC_DATA_ACK}{' '}
      <a
        href={`#${SOURCES_ANCHOR_ID}`}
        // Stays in the sentence; the padding (cancelled by the margin) makes the tap area 44px tall.
        className={`-my-3 inline-block py-3 font-semibold text-foreground underline underline-offset-2 ${focusRing}`}
      >
        Sources
      </a>
    </p>
  );
}

function LinkItem({ link }: { link: SourceLink }) {
  return (
    <li>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex min-h-11 items-center break-all underline underline-offset-2 hover:text-foreground ${focusRing}`}
      >
        {link.url}
      </a>
    </li>
  );
}

/**
 * The source links written out in full, grouped by who published them. The
 * first few of a group show at once; the rest fold under "Show N more links".
 */
export function SourcesSection({
  groups,
  checkedOn,
  className = '',
}: {
  groups: readonly { key?: string; label: string; links: readonly SourceLink[] }[];
  checkedOn?: string | null;
  className?: string;
}) {
  const list = sourceGroups(groups);
  if (!list.length) return null;
  return (
    <section id={SOURCES_ANCHOR_ID} aria-labelledby={`${SOURCES_ANCHOR_ID}-title`} className={`flex scroll-mt-24 flex-col gap-2 ${className}`}>
      <h2 id={`${SOURCES_ANCHOR_ID}-title`} className="text-[14px] font-semibold text-foreground">
        Sources
      </h2>
      <p>
        {PUBLIC_DATA_ACK}
        {checkedOn ? ` Checked ${checkedOn}.` : ''}
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((g) => {
          const { first, rest } = splitLinks(g.links);
          return (
            <li key={g.key}>
              <span className="font-semibold text-foreground">{g.label}</span>
              <ul className="flex flex-col">
                {first.map((l) => (
                  <LinkItem key={l.url} link={l} />
                ))}
              </ul>
              {rest.length ? (
                <details>
                  <summary className={`inline-flex min-h-12 cursor-pointer items-center font-semibold text-foreground ${focusRing}`}>
                    Show {rest.length} more links
                  </summary>
                  <ul className="flex flex-col">
                    {rest.map((l) => (
                      <LinkItem key={l.url} link={l} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

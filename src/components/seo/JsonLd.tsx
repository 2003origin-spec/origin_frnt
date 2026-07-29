/**
 * Renders a JSON-LD <script> for structured data (rich results + LLM extraction).
 * Server-safe and works inside client components too — Next SSRs the initial
 * render, so the script lands in the crawlable HTML.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is our own trusted, serialized content; escape "<" to
      // be safe against any string value breaking out of the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

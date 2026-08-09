import { toAbsoluteMediaUrl } from "@/lib/media-url";

export type NormalizedCbtOption = { text: string; image: string | null };

/**
 * Coerce a stored CBT `options` JSONB value into the canonical
 * `{ text, image }[]` shape the players/editor expect.
 *
 * The column has held several shapes over time: plain `string[]` (early/seeded
 * and some imported questions) and `{ text, image? }[]` (current). The test
 * player reads `opt.text`/`opt.image`, so a raw cast leaves string-shaped
 * options with `opt.text === undefined` → the option renders blank. Normalising
 * on read makes BOTH text and image options show regardless of stored shape,
 * and repairs scheme-less image URLs (see toAbsoluteMediaUrl).
 */
export function normalizeCbtOptions(raw: unknown): NormalizedCbtOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      const obj = typeof o === "string" ? { text: o } : (o as { text?: unknown; image?: unknown });
      const text = String(obj?.text ?? "").trim();
      const rawImage = typeof obj?.image === "string" && obj.image.trim() ? obj.image.trim() : null;
      return { text, image: toAbsoluteMediaUrl(rawImage) };
    })
    // Keep an option if it has text OR an image (image-only options are valid).
    .filter((o) => o.text.length > 0 || o.image);
}

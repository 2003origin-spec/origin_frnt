/**
 * Pure rules for the Origin Store pilot (plan doc "Origin Store": premium
 * subject time for coins and digital papers; merch and coin + rupee checkout
 * come after the pilot). Build step 9.
 */

export const PILOT_ITEM_KINDS = ["premium", "digital"] as const;
export type PilotItemKind = (typeof PILOT_ITEM_KINDS)[number];
export const STORE_SUBJECTS = ["physics", "chemistry", "mathematics", "biology"] as const;

export const PAPER_MAX_BYTES = 50 * 1024 * 1024;
export const PAPER_MIME_TYPES = ["application/pdf"] as const;
export const DOWNLOAD_LINK_SECONDS = 600;
export const DAY_MS = 24 * 60 * 60_000;

export type StoreItemInput = {
  kind: string;
  title: string;
  description?: string | null;
  priceCoins: number;
  pricePaise?: number;
  stock?: number | null;
  premiumSubject?: string | null;
  premiumDays?: number | null;
  active?: boolean;
  featured?: boolean;
  hasFile?: boolean;
};

/** What an admin may list during the pilot. */
export function validateStoreItem(input: StoreItemInput): string[] {
  const errors: string[] = [];
  if (!(PILOT_ITEM_KINDS as readonly string[]).includes(input.kind)) {
    errors.push("During the pilot the store sells premium time and digital papers only.");
  }
  if (!input.title?.trim() || input.title.trim().length > 120) errors.push("Title is required (120 characters at most).");
  if ((input.description ?? "").length > 2000) errors.push("Description is too long.");
  if (!Number.isInteger(input.priceCoins) || input.priceCoins <= 0) errors.push("Price must be a whole number of coins above 0.");
  if ((input.pricePaise ?? 0) !== 0) errors.push("Rupee and mixed prices come after the pilot; set the rupee price to 0.");
  if (input.stock !== null && input.stock !== undefined && (!Number.isInteger(input.stock) || input.stock < 0)) {
    errors.push("Stock must be empty (unlimited) or a whole number.");
  }
  if (input.kind === "premium") {
    if (!(STORE_SUBJECTS as readonly string[]).includes(input.premiumSubject ?? "")) errors.push("Pick the subject this premium unlocks.");
    if (!Number.isInteger(input.premiumDays) || (input.premiumDays ?? 0) < 1 || (input.premiumDays ?? 0) > 366) {
      errors.push("Premium days must be 1 to 366.");
    }
  }
  if (input.kind === "digital" && input.active && !input.hasFile) {
    errors.push("Upload the paper before switching the item on.");
  }
  return errors;
}

/**
 * Coin-bought premium stacks on the student's own coin premium for that
 * subject: it starts when their latest coin grant ends (or now), never earlier.
 */
export function premiumWindow(latestCoinGrantExpiry: Date | null, days: number, now: Date): { start: Date; end: Date } {
  const start = latestCoinGrantExpiry && latestCoinGrantExpiry.getTime() > now.getTime() ? latestCoinGrantExpiry : now;
  return { start, end: new Date(start.getTime() + days * DAY_MS) };
}

export function isPaperUpload(mimeType: string, sizeBytes: number): boolean {
  return (PAPER_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase()) && sizeBytes > 0 && sizeBytes <= PAPER_MAX_BYTES;
}

export function paperObjectKey(itemId: string, nonce: string): string {
  return `origin-now/store/${itemId}/${nonce}.pdf`;
}

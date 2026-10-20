/**
 * Pure rules for the Origin Store (plan doc "Origin Store"): premium subject
 * time for coins and digital papers (build step 9); merch with delivery
 * (B91) and rupee prices (B92) once switched on in Settings → Extra parts.
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
  /** Merch: size → stock (B91); null or absent for one-size items. */
  sizeStock?: unknown;
};

export type StoreFeatures = { merch: boolean; rupeePrices: boolean };

/** Rupee prices (B92): ₹1 to ₹1,00,000, in paise. */
export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 10_000_000;
/** An unpaid rupee checkout gives its coins and stock back after this long (the payment order lives 30 minutes). */
export const CHECKOUT_RELEASE_MS = 45 * 60_000;

/** "₹499" / "₹49.50" from paise. */
export function rupeesText(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2, maximumFractionDigits: 2 })}`;
}
const PILOT_ONLY: StoreFeatures = { merch: false, rupeePrices: false };

/** What an admin may list, given the switches in Settings → Extra parts. */
export function validateStoreItem(input: StoreItemInput, features: StoreFeatures = PILOT_ONLY): string[] {
  const errors: string[] = [];
  if (!allowedItemKinds(features).includes(input.kind)) {
    errors.push(
      input.kind === "merch"
        ? "Switch on \"Merch in the store\" in Settings → Extra parts before listing merch."
        : "The store sells premium time and digital papers (and merch once switched on).",
    );
  }
  if (!input.title?.trim() || input.title.trim().length > 120) errors.push("Title is required (120 characters at most).");
  if ((input.description ?? "").length > 2000) errors.push("Description is too long.");
  const paise = input.pricePaise ?? 0;
  if (!Number.isInteger(input.priceCoins) || input.priceCoins < 0) errors.push("Coins must be a whole number, 0 or more.");
  if (!Number.isInteger(paise) || paise < 0 || paise > MAX_PRICE_PAISE) {
    errors.push("The rupee price must be from ₹0 to ₹1,00,000.");
  } else if (paise > 0 && !features.rupeePrices) {
    errors.push("Switch on \"Rupee prices in the store\" in Settings → Extra parts before adding a rupee price.");
  } else if (paise > 0 && paise < MIN_PRICE_PAISE) {
    errors.push("A rupee price must be at least ₹1.");
  }
  if (input.priceCoins === 0 && paise === 0) errors.push("Price must be a whole number of coins above 0, or a rupee price.");
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
  if (input.kind === "merch") {
    const sizes = parseSizeStock(input.sizeStock);
    if (typeof sizes === "string") errors.push(sizes);
    else if (sizes && input.stock !== null && input.stock !== undefined) errors.push("With sizes, set the stock per size and leave the item stock empty.");
  } else if (input.sizeStock !== null && input.sizeStock !== undefined) {
    errors.push("Only merch has sizes.");
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

// ---------------------------------------------------------------------------
// Merch with delivery (decision B91).

/** Item kinds an admin may list, by the switches in Settings → Extra parts. */
export function allowedItemKinds(features: { merch: boolean }): readonly string[] {
  return features.merch ? [...PILOT_ITEM_KINDS, "merch"] : PILOT_ITEM_KINDS;
}

export const MAX_SIZES = 12;
const SIZE_LABEL = /^[A-Za-z0-9 ]{1,8}$/;

/**
 * Sizes and their stock ("S" → 10). Null when the item has no sizes. Order
 * is kept as given (S, M, L, XL). Returns an error string for bad input.
 */
export function parseSizeStock(raw: unknown): Record<string, number> | null | string {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return "Sizes must be a list of size and stock.";
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return null;
  if (entries.length > MAX_SIZES) return `At most ${MAX_SIZES} sizes.`;
  const out: Record<string, number> = {};
  for (const [rawSize, rawCount] of entries) {
    const size = rawSize.trim();
    if (!SIZE_LABEL.test(size)) return "Size names are 1 to 8 letters or digits, such as S, M, XL or 32.";
    if (size in out) return `Size ${size} is listed twice.`;
    if (!Number.isInteger(rawCount) || (rawCount as number) < 0 || (rawCount as number) > 100_000) {
      return `Stock for size ${size} must be a whole number from 0 to 100000.`;
    }
    out[size] = rawCount as number;
  }
  return out;
}

const CLOTHING_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL"];

/**
 * Sizes in shop order: clothing sizes (XS, S, M, L, XL…), then numbers
 * (28, 30, 32), then anything else alphabetically. The database keeps sizes
 * in a JSON object, which does not keep the order they were typed in.
 */
export function sortSizes(sizes: readonly string[]): string[] {
  const rank = (s: string): [number, number, string] => {
    const clothing = CLOTHING_ORDER.indexOf(s.toUpperCase());
    if (clothing >= 0) return [0, clothing, s];
    if (/^\d+$/.test(s)) return [1, Number(s), s];
    return [2, 0, s.toLowerCase()];
  };
  return [...sizes].sort((a, b) => {
    const [ga, na, ta] = rank(a);
    const [gb, nb, tb] = rank(b);
    return ga - gb || na - nb || ta.localeCompare(tb);
  });
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
  "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
] as const;

export type DeliveryAddress = {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
};

/** Addresses are wiped this long after the order is delivered or cancelled. */
export const ADDRESS_KEEP_DAYS = 90;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** An Indian mobile number as 10 digits: "+91 98765-43210" → "9876543210"; null if not one. */
export function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s()-]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function validateDeliveryAddress(raw: unknown): { ok: true; address: DeliveryAddress } | { ok: false; errors: string[] } {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const name = clean(input.name);
  const phone = normalizeIndianMobile(clean(input.phone));
  const line1 = clean(input.line1);
  const line2 = clean(input.line2) || null;
  const city = clean(input.city);
  const stateRaw = clean(input.state).toLowerCase();
  const state = INDIAN_STATES.find((s) => s.toLowerCase() === stateRaw) ?? null;
  const pincode = clean(input.pincode).replace(/\s/g, "");
  if (name.length < 2 || name.length > 80) errors.push("Enter the name to deliver to.");
  if (!phone) errors.push("Enter a 10-digit Indian mobile number for the courier.");
  if (line1.length < 5 || line1.length > 120) errors.push("Enter the house, street and area.");
  if (line2 && line2.length > 120) errors.push("The second address line is too long.");
  if (city.length < 2 || city.length > 60) errors.push("Enter the town or city.");
  if (!state) errors.push("Pick the state.");
  if (!/^[1-9]\d{5}$/.test(pincode)) errors.push("Enter the 6-digit PIN code.");
  if (errors.length) return { ok: false, errors };
  return { ok: true, address: { name, phone: phone!, line1, line2, city, state: state!, pincode } };
}

/** What the buyer's order list shows once the order exists: the place, not the street. */
export function addressSummary(address: DeliveryAddress | null): string | null {
  return address ? `${address.city}, ${address.state} ${address.pincode}` : null;
}

export const SHIP_STATUSES = ["to_pack", "packed", "shipped", "delivered", "cancelled"] as const;
export type ShipStatus = (typeof SHIP_STATUSES)[number];
export type ShipAction = "pack" | "ship" | "deliver" | "cancel";

/** The next shipping state for an admin action, or null when the action is not allowed now. */
export function nextShipStatus(current: ShipStatus, action: ShipAction): ShipStatus | null {
  switch (action) {
    case "pack":
      return current === "to_pack" ? "packed" : null;
    case "ship":
      return current === "to_pack" || current === "packed" ? "shipped" : null;
    case "deliver":
      return current === "shipped" ? "delivered" : null;
    case "cancel":
      // Once it has left, it cannot be cancelled here (a return is handled by hand).
      return current === "to_pack" || current === "packed" ? "cancelled" : null;
  }
}

export function validateShipment(courier: unknown, trackingNo: unknown): string[] {
  const errors: string[] = [];
  const c = clean(courier);
  const t = clean(trackingNo);
  if (c.length < 2 || c.length > 40) errors.push("Enter the courier's name.");
  if (!/^[A-Za-z0-9-]{4,40}$/.test(t)) errors.push("Enter the tracking number (4 to 40 letters, digits or dashes).");
  return errors;
}

export const MERCH_IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MERCH_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function merchImageObjectKey(itemId: string, nonce: string, mimeType: string): string | null {
  const ext = MERCH_IMAGE_TYPES[mimeType.toLowerCase()];
  return ext ? `origin-now/store-images/${itemId}/${nonce}.${ext}` : null;
}

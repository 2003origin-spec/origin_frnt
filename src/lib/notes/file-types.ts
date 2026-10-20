/**
 * Origin Notes — the file types Notes accepts, and how each is recognised from
 * its first bytes ("magic bytes"). The browser's reported type is only a claim;
 * the server re-reads the stored object and rejects anything whose bytes don't
 * match the declared type (V1/NOTES_PLAN.md §8). HTML, SVG, scripts and
 * archives are never accepted.
 *
 * Phase 1 (shared library) uploads accept `pdf` and `image`. The audio, video
 * and Office rows are here so Phase 3 (My Notes) reuses one table.
 */

export type NotesFileKind = "pdf" | "image" | "office" | "audio" | "video";

export type NotesFileType = {
  mime: string;
  kind: NotesFileKind;
  /** Extension used for stored object keys and download names. */
  ext: string;
  /** Other extensions a browser may report for the same type. */
  aliases?: string[];
  label: string;
  /** True when the app can show it inline (pdf.js / <img> / <audio> / <video>). */
  previewable: boolean;
};

export const NOTES_FILE_TYPES: readonly NotesFileType[] = [
  { mime: "application/pdf", kind: "pdf", ext: "pdf", label: "PDF", previewable: true },
  { mime: "image/jpeg", kind: "image", ext: "jpg", aliases: ["jpeg"], label: "Photo", previewable: true },
  { mime: "image/png", kind: "image", ext: "png", label: "Photo", previewable: true },
  { mime: "image/webp", kind: "image", ext: "webp", label: "Photo", previewable: true },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    kind: "office",
    ext: "docx",
    label: "Word",
    previewable: false,
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    kind: "office",
    ext: "pptx",
    label: "PowerPoint",
    previewable: false,
  },
  { mime: "audio/webm", kind: "audio", ext: "weba", aliases: ["webm"], label: "Voice note", previewable: true },
  { mime: "audio/ogg", kind: "audio", ext: "ogg", aliases: ["oga", "opus"], label: "Voice note", previewable: true },
  { mime: "audio/mp4", kind: "audio", ext: "m4a", aliases: ["mp4"], label: "Voice note", previewable: true },
  { mime: "audio/mpeg", kind: "audio", ext: "mp3", label: "Audio", previewable: true },
  { mime: "audio/wav", kind: "audio", ext: "wav", aliases: ["wave"], label: "Audio", previewable: true },
  { mime: "video/mp4", kind: "video", ext: "mp4", aliases: ["m4v"], label: "Video", previewable: true },
  { mime: "video/webm", kind: "video", ext: "webm", label: "Video", previewable: true },
  { mime: "video/quicktime", kind: "video", ext: "mov", label: "Video", previewable: true },
];

const BY_MIME = new Map(NOTES_FILE_TYPES.map((type) => [type.mime, type]));

/** Mime aliases browsers send for the same thing. */
const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-m4a": "audio/mp4",
  "audio/mp3": "audio/mpeg",
};

/** Lower-cases, drops `;codecs=…` parameters and folds known aliases. */
export function normaliseMime(raw: string | null | undefined): string {
  const base = String(raw ?? "").split(";")[0].trim().toLowerCase();
  return MIME_ALIASES[base] ?? base;
}

export function fileTypeForMime(raw: string | null | undefined): NotesFileType | null {
  return BY_MIME.get(normaliseMime(raw)) ?? null;
}

/** Kinds the shared library accepts in Phase 1. */
export const LIBRARY_UPLOAD_KINDS: readonly NotesFileKind[] = ["pdf", "image"];

/** Admin library uploads: one PDF or photo up to 50 MB. */
export const LIBRARY_MAX_FILE_BYTES = 50 * 1024 * 1024;

/** How many leading bytes the server reads to check a file. */
export const MAGIC_SNIFF_BYTES = 1024;

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function indexOfSequence(bytes: Uint8Array, signature: readonly number[], limit: number): number {
  const end = Math.min(bytes.length, limit) - signature.length;
  for (let i = 0; i <= end; i += 1) {
    if (startsWith(bytes, signature, i)) return i;
  }
  return -1;
}

const PDF_HEADER = ascii("%PDF-");
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const RIFF = ascii("RIFF");
const WEBP = ascii("WEBP");
const WAVE = ascii("WAVE");
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const EBML = [0x1a, 0x45, 0xdf, 0xa3];
const OGG = ascii("OggS");
const ID3 = ascii("ID3");
const FTYP = ascii("ftyp");

/** The container family the bytes look like, or null when unrecognised. */
export type MagicFamily = "pdf" | "png" | "jpeg" | "webp" | "zip" | "ebml" | "ogg" | "mp3" | "wav" | "isobmff";

export function sniffMagic(bytes: Uint8Array): MagicFamily | null {
  // The PDF spec allows the header anywhere in the first 1024 bytes.
  if (indexOfSequence(bytes, PDF_HEADER, 1024) !== -1) return "pdf";
  if (startsWith(bytes, PNG)) return "png";
  if (startsWith(bytes, JPEG)) return "jpeg";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "webp";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WAVE, 8)) return "wav";
  if (startsWith(bytes, ZIP)) return "zip";
  if (startsWith(bytes, EBML)) return "ebml";
  if (startsWith(bytes, OGG)) return "ogg";
  if (startsWith(bytes, FTYP, 4)) return "isobmff";
  if (startsWith(bytes, ID3)) return "mp3";
  // Bare MPEG audio frame sync: 11 set bits.
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "mp3";
  return null;
}

const FAMILY_FOR_MIME: Record<string, MagicFamily> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "zip",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "zip",
  "audio/webm": "ebml",
  "video/webm": "ebml",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "isobmff",
  "video/mp4": "isobmff",
  "video/quicktime": "isobmff",
};

/** True when the stored bytes really are the declared type. */
export function bytesMatchMime(bytes: Uint8Array, declaredMime: string): boolean {
  const expected = FAMILY_FOR_MIME[normaliseMime(declaredMime)];
  if (!expected) return false;
  return sniffMagic(bytes) === expected;
}

/** File name safe for a Content-Disposition header, keeping the right extension. */
export function safeDownloadName(rawName: string | null | undefined, type: NotesFileType): string {
  const base = String(rawName ?? "")
    .replace(/\.[^.]*$/u, "")
    // \p{M} keeps combining marks (Hindi vowel signs: गति must not become गत).
    .replace(/[^\p{L}\p{M}\p{N} ._()-]+/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 80);
  return `${base || "notes"}.${type.ext}`;
}

/** Extension check for the picked file name (a second, cheap signal before upload). */
export function extensionMatchesType(fileName: string, type: NotesFileType): boolean {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return ext === type.ext || (type.aliases ?? []).includes(ext);
}

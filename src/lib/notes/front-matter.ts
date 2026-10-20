/**
 * Minimal front-matter reader for imported note files (V1/NOTES_PLAN.md §13).
 *
 * Accepts only the subset the note files use — `key: value`, quoted strings and
 * `[a, b]` lists — so no YAML dependency (and none of YAML's surprises, like
 * `no` turning into false) is needed.
 *
 *   ---
 *   title: "Motion in a Plane: Formula Sheet"
 *   type: formula_sheet
 *   exams: [jee, neet]
 *   chapter: c11.physics.motion-in-a-plane
 *   ---
 */

export type FrontMatterValue = string | string[];

export type FrontMatter = {
  data: Record<string, FrontMatterValue>;
  body: string;
  /** 1-based line of the body's first line in the original file. */
  bodyLine: number;
  errors: string[];
};

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1).replace(/\\"/gu, '"');
    }
  }
  return value;
}

function parseValue(raw: string): FrontMatterValue {
  const value = raw.trim();
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((part) => unquote(part))
      .filter((part) => part.length > 0);
  }
  return unquote(value);
}

export function parseFrontMatter(source: string): FrontMatter {
  const text = source.replace(/^﻿/u, "").replace(/\r\n?/gu, "\n");
  const lines = text.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { data: {}, body: text, bodyLine: 1, errors: [] };
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return { data: {}, body: text, bodyLine: 1, errors: ["The header starts with --- but never ends with ---."] };
  }
  const data: Record<string, FrontMatterValue> = {};
  const errors: string[] = [];
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon <= 0) {
      errors.push(`Header line ${i + 1} is not "key: value".`);
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]*$/u.test(key)) {
      errors.push(`Header line ${i + 1} has an invalid key "${key}".`);
      continue;
    }
    data[key] = parseValue(line.slice(colon + 1));
  }
  const body = lines.slice(end + 1).join("\n").replace(/^\n+/u, "");
  const skipped = lines.slice(end + 1).findIndex((line) => line.trim().length > 0);
  return { data, body, bodyLine: end + 2 + Math.max(0, skipped), errors };
}

export function frontMatterString(data: Record<string, FrontMatterValue>, key: string): string | null {
  const value = data[key];
  if (typeof value === "string") return value.trim() || null;
  return null;
}

export function frontMatterList(data: Record<string, FrontMatterValue>, key: string): string[] {
  const value = data[key];
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

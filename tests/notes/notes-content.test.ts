/**
 * Every note file in data/notes must import cleanly: a valid header, a chapter
 * key that exists in the standard folders, and no formula or box errors —
 * the same checks Admin → Notes → Import runs, enforced in CI so a broken
 * formula never reaches a reviewer. V1/NOTES_PLAN.md §13.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { frontMatterString, parseFrontMatter } from "../../src/lib/notes/front-matter";
import { slugify } from "../../src/lib/notes/rules";
import { listSyllabusChapters } from "../../src/lib/notes/syllabus";
import { NOTES_NOTE_TYPES } from "../../src/lib/notes/types";
import { analyseNoteMarkdown } from "../../src/server/notes/markdown-validate";

const root = new URL("../..", import.meta.url).pathname;
const notesDir = join(root, "data/notes");

function noteFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return noteFiles(path);
    return path.endsWith(".md") && basename(path).toLowerCase() !== "readme.md" ? [path] : [];
  });
}

const files = noteFiles(notesDir);
const chapterKeys = new Set(listSyllabusChapters().map((chapter) => chapter.key));

test("note files import cleanly (headers, chapter keys, formulas, boxes)", { skip: files.length === 0 }, () => {
  const problems: string[] = [];
  const keys = new Map<string, string>();
  for (const file of files) {
    const where = relative(root, file);
    const header = parseFrontMatter(readFileSync(file, "utf8"));
    for (const error of header.errors) problems.push(`${where}: ${error}`);
    const title = frontMatterString(header.data, "title");
    const type = frontMatterString(header.data, "type");
    const chapter = frontMatterString(header.data, "chapter");
    if (!title) problems.push(`${where}: missing title`);
    if (!type || !(NOTES_NOTE_TYPES as readonly string[]).includes(type)) problems.push(`${where}: bad type "${type}"`);
    if (!chapter || !chapterKeys.has(chapter)) problems.push(`${where}: unknown chapter "${chapter}"`);
    const key = frontMatterString(header.data, "key") ?? (chapter && type ? `${chapter}.${slugify(type)}` : null);
    if (key) {
      if (keys.has(key)) problems.push(`${where}: same key as ${keys.get(key)}`);
      keys.set(key, where);
    }
    const analysis = analyseNoteMarkdown(header.body, header.bodyLine - 1);
    for (const issue of [...analysis.errors, ...analysis.warnings]) {
      problems.push(`${where}:${issue.line ?? "?"} ${issue.message}`);
    }
  }
  assert.deepEqual(problems, [], `Fix these note files:\n${problems.join("\n")}`);
});

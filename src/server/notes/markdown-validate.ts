/**
 * Origin Notes — server-side checks for typed notes (V1/NOTES_PLAN.md §13).
 *
 * Parses a note the same way the renderer does (GFM + math + directives) and
 * reports:
 *   errors   — block an import: a formula KaTeX can't compile, an unknown box,
 *              raw HTML;
 *   warnings — shown but allowed: a question with no answer separator, an
 *              image that isn't https.
 * Also returns the note's plain text for search (`notes.items.body_text`).
 */

import katex from "katex";
import "katex/contrib/mhchem";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import { unified } from "unified";
import type { Root } from "mdast";

import { findNoteBoxIssues, NOTE_KATEX_LIMITS } from "@/lib/notes/markdown-boxes";

export type NoteIssue = { line: number | null; message: string };

export type NoteAnalysis = {
  errors: NoteIssue[];
  warnings: NoteIssue[];
  plainText: string;
};

type MdNode = {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  position?: { start?: { line?: number } };
};

const PLAIN_TEXT_MAX = 100_000;

export function parseNoteMarkdown(markdown: string): Root {
  return unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective).parse(markdown) as Root;
}

export function analyseNoteMarkdown(markdown: string, lineOffset = 0): NoteAnalysis {
  const tree = parseNoteMarkdown(markdown);
  const errors: NoteIssue[] = [];
  const warnings: NoteIssue[] = [];
  const text: string[] = [];
  const at = (node: MdNode) => (node.position?.start?.line ? node.position.start.line + lineOffset : null);

  for (const issue of findNoteBoxIssues(tree)) {
    const line = issue.line === null ? null : issue.line + lineOffset;
    if (issue.message.startsWith("Unknown box")) errors.push({ line, message: issue.message });
    else warnings.push({ line, message: issue.message });
  }

  const visit = (node: MdNode) => {
    switch (node.type) {
      case "html":
        errors.push({ line: at(node), message: "Raw HTML isn't allowed in notes. Use Markdown or a box instead." });
        return;
      case "math":
      case "inlineMath": {
        const source = node.value ?? "";
        try {
          katex.renderToString(source, { displayMode: node.type === "math", throwOnError: true, strict: "ignore", ...NOTE_KATEX_LIMITS });
        } catch (error) {
          const reason = error instanceof Error ? error.message.replace(/^KaTeX parse error:\s*/u, "") : "it does not compile";
          errors.push({ line: at(node), message: `Formula error: ${reason}` });
        }
        // Formula source stays out of the search text: students search words,
        // and LaTeX would show up as gibberish in result previews.
        text.push(" ");
        return;
      }
      case "image":
        if (!/^https:\/\//iu.test(node.url ?? "")) {
          warnings.push({ line: at(node), message: "Images should use an https:// link (upload them with the image button)." });
        }
        return;
      case "text":
      case "inlineCode":
      case "code":
        text.push(node.value ?? "");
        return;
      case "containerDirective": {
        // Box titles ("Time of flight") are good search words.
        const title = (node as MdNode & { attributes?: Record<string, string | null> }).attributes?.title;
        if (title) text.push(title, ":");
        break;
      }
      default:
        break;
    }
    for (const child of node.children ?? []) visit(child);
    if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem" || node.type === "tableCell") {
      text.push(" ");
    }
  };
  visit(tree as unknown as MdNode);

  const plainText = text.join(" ").replace(/\s+/gu, " ").trim().slice(0, PLAIN_TEXT_MAX);
  return { errors, warnings, plainText };
}

/** Only the plain text (search index) — never throws on a broken formula. */
export function noteMarkdownPlainText(markdown: string): string {
  try {
    return analyseNoteMarkdown(markdown).plainText;
  } catch {
    return markdown.replace(/\s+/gu, " ").trim().slice(0, PLAIN_TEXT_MAX);
  }
}

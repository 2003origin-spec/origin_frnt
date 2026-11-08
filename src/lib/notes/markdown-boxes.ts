/**
 * Origin Notes — the note boxes (V1/NOTES_PLAN.md Appendix B).
 *
 * Typed notes are Markdown + LaTeX plus a few container boxes written with
 * remark-directive's `:::name{attrs}` syntax:
 *
 *   :::formula{title="Time of flight"}
 *   $$T = \frac{2u\sin\theta}{g}$$
 *   :::
 *
 * `remarkNoteBoxes` turns each known container into a `<div data-note-box=…>`
 * the renderer styles, and splits `:::question` at its first `---` into the
 * question and the hidden answer.
 *
 * remark-directive also treats `:word` inside ordinary text as a "text
 * directive", which would silently eat text like "Ans:A" or "ratio 3:x". Notes
 * only use container boxes, so every text and leaf directive is turned back
 * into the literal text it came from.
 */

import type { Parent, Root, RootContent } from "mdast";

export const NOTE_BOXES = ["formula", "remember", "trap", "tip", "example", "question"] as const;

/**
 * KaTeX limits for every note formula (renderer AND import/save checks). The
 * defaults allow 1000 macro expansions and any size, so one 2 KB \def formula
 * froze a reader for seconds. The busiest real formula in data/notes needs 9.
 */
export const NOTE_KATEX_LIMITS = { maxExpand: 100, maxSize: 10 } as const;
export type NoteBox = (typeof NOTE_BOXES)[number];

export function isNoteBox(name: string): name is NoteBox {
  return (NOTE_BOXES as readonly string[]).includes(name);
}

/** Attribute values longer than this are cut, so a box header can't balloon. */
const ATTR_MAX = 120;

type DirectiveNode = Parent & {
  type: "containerDirective" | "leafDirective" | "textDirective";
  name: string;
  attributes?: Record<string, string | null | undefined> | null;
  data?: Record<string, unknown>;
};

type AnyNode = { type: string; children?: AnyNode[]; value?: string; data?: Record<string, unknown> };

function isDirective(node: AnyNode): node is AnyNode & DirectiveNode {
  return node.type === "containerDirective" || node.type === "leafDirective" || node.type === "textDirective";
}

function plainText(node: AnyNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(plainText).join("");
}

function attr(node: DirectiveNode, key: string): string | null {
  const value = node.attributes?.[key];
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/gu, " ").trim();
  return trimmed ? trimmed.slice(0, ATTR_MAX) : null;
}

function textNode(value: string): AnyNode {
  return { type: "text", value };
}

type Positioned = AnyNode & { depth?: number; position?: { start?: { line?: number }; end?: { line?: number } } };

/** A level-2 heading written as "text" + "---" on the next line. */
function isSetextHeading(node: AnyNode): boolean {
  const heading = node as Positioned;
  if (heading.type !== "heading" || heading.depth !== 2) return false;
  const start = heading.position?.start?.line;
  const end = heading.position?.end?.line;
  return typeof start === "number" && typeof end === "number" && end > start;
}

/** `:name[label]` back to literal text (attributes are dropped — notes never use them inline). */
function restoreInline(node: DirectiveNode): AnyNode[] {
  const prefix = node.type === "leafDirective" ? "::" : ":";
  const children = (node.children ?? []) as unknown as AnyNode[];
  if (children.length === 0) return [textNode(`${prefix}${node.name}`)];
  return [textNode(`${prefix}${node.name}[`), ...children, textNode("]")];
}

function transformContainer(node: DirectiveNode): void {
  const children = [...((node.children ?? []) as unknown as AnyNode[])];
  // `:::formula[Label]` puts the label in a first paragraph flagged directiveLabel.
  let label: string | null = null;
  const first = children[0];
  if (first?.type === "paragraph" && first.data && (first.data as { directiveLabel?: boolean }).directiveLabel) {
    label = plainText(first).trim().slice(0, ATTR_MAX) || null;
    children.shift();
  }

  const known = isNoteBox(node.name);
  const properties: Record<string, string> = { "data-note-box": known ? node.name : "unknown" };
  const title = attr(node, "title") ?? label;
  if (title) properties["data-title"] = title;
  const exam = attr(node, "exam");
  if (exam) properties["data-exam"] = exam;

  if (node.name === "question") {
    let split = children.findIndex((child) => child.type === "thematicBreak");
    if (split === -1) {
      // `---` right under a text line (no blank line between) is Markdown for
      // "make that line a heading", not a separator. Authors mean the
      // separator, so a two-line level-2 heading is read as text + split.
      const setext = children.findIndex((child) => isSetextHeading(child));
      if (setext !== -1) {
        const heading = children[setext];
        children.splice(setext, 1, { type: "paragraph", children: heading.children ?? [] }, { type: "thematicBreak" });
        split = setext + 1;
      }
    }
    const questionPart = split === -1 ? children : children.slice(0, split);
    const answerPart = split === -1 ? [] : children.slice(split + 1);
    const parts: AnyNode[] = [
      { type: "noteBoxPart", children: questionPart, data: { hName: "div", hProperties: { "data-note-part": "question" } } },
    ];
    if (answerPart.length > 0) {
      parts.push({ type: "noteBoxPart", children: answerPart, data: { hName: "div", hProperties: { "data-note-part": "answer" } } });
    }
    node.children = parts as unknown as Parent["children"];
  } else {
    node.children = children as unknown as Parent["children"];
  }

  node.data = { ...(node.data ?? {}), hName: "div", hProperties: properties };
}

function walk(parent: AnyNode): void {
  const children = parent.children;
  if (!children) return;
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (isDirective(child)) {
      if (child.type === "containerDirective") {
        transformContainer(child);
      } else if (child.type === "textDirective") {
        const replacement = restoreInline(child);
        children.splice(i, 1, ...replacement);
        i += replacement.length - 1;
        continue;
      } else {
        // A leaf directive is a whole line; keep it as a paragraph of text.
        children.splice(i, 1, { type: "paragraph", children: restoreInline(child) });
        continue;
      }
    }
    walk(child);
  }
}

/** Unified/remark plugin. Use after remark-directive and before remark-rehype. */
export function remarkNoteBoxes() {
  return (tree: Root) => {
    walk(tree as unknown as AnyNode);
  };
}

export type NoteBoxIssue = { line: number | null; message: string };

/**
 * Lint pass for the importer and the editor: unknown box names and questions
 * without a `---` answer separator. Runs on the tree BEFORE `remarkNoteBoxes`.
 */
export function findNoteBoxIssues(tree: Root): NoteBoxIssue[] {
  const issues: NoteBoxIssue[] = [];
  const visit = (node: AnyNode & { position?: { start?: { line?: number } } }) => {
    if (node.type === "containerDirective") {
      const directive = node as unknown as DirectiveNode & { position?: { start?: { line?: number } } };
      const line = directive.position?.start?.line ?? null;
      if (!isNoteBox(directive.name)) {
        issues.push({ line, message: `Unknown box ":::${directive.name}". Use one of: ${NOTE_BOXES.join(", ")}.` });
      } else if (directive.name === "question") {
        const hasAnswer = ((directive.children ?? []) as unknown as AnyNode[]).some(
          (child) => child.type === "thematicBreak" || isSetextHeading(child),
        );
        if (!hasAnswer) issues.push({ line, message: "This question box has no --- line before its answer." });
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree as unknown as AnyNode);
  return issues;
}

export type { RootContent };

/**
 * A line that is ONLY `$$…$$` is meant as a big centred formula, but
 * remark-math reads single-line `$$…$$` as inline maths. Rewrite such lines
 * into the fenced form (`$$` / formula / `$$`) before rendering. Lines inside
 * ``` code fences, and `$$` used mid-sentence, are left alone.
 */
export function normaliseDisplayMath(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inCode = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/u.test(line)) inCode = !inCode;
    const match = inCode ? null : /^(\s*)\$\$([^$]+?)\$\$\s*$/u.exec(line);
    if (match) {
      out.push(`${match[1]}$$`, `${match[1]}${match[2].trim()}`, `${match[1]}$$`);
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

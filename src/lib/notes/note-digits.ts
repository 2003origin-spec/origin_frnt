/**
 * Origin Notes — readable digits in the Notebook look (V1/NOTES_PLAN.md Appendix B).
 *
 * The handwriting face draws "1" as a plain stroke, so "1 : 2 : 1" reads as
 * "I : 2 : I" and "F1" as "FI". Digits in ordinary note text are wrapped in
 * `<span class="note-num">`, which the Notebook style sets in the UI font.
 * Formulas (KaTeX output) and code are left alone: they have their own fonts.
 */

import type { Element, ElementContent, Root } from "hast";

export const NOTE_DIGIT_CLASS = "note-num";

export type DigitPart = { text: string; digits: boolean };

/** "F1 selfed, 3:1" → F · 1 · " selfed, " · 3 · ":" · 1 */
export function splitDigits(text: string): DigitPart[] {
  return text
    .split(/(\d+)/u)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, digits: /^\d+$/u.test(part) }));
}

function skipped(node: Element): boolean {
  if (node.tagName === "code" || node.tagName === "pre") return true;
  const className = node.properties?.className;
  const classes = Array.isArray(className) ? className.map(String) : typeof className === "string" ? className.split(/\s+/u) : [];
  return classes.some((name) => name === "katex" || name === "katex-display" || name === NOTE_DIGIT_CLASS);
}

function wrap(parent: Root | Element): void {
  let changed = false;
  const children: ElementContent[] = [];
  for (const child of parent.children as ElementContent[]) {
    if (child.type === "text" && /\d/u.test(child.value)) {
      changed = true;
      for (const part of splitDigits(child.value)) {
        children.push(
          part.digits
            ? { type: "element", tagName: "span", properties: { className: [NOTE_DIGIT_CLASS] }, children: [{ type: "text", value: part.text }] }
            : { type: "text", value: part.text },
        );
      }
      continue;
    }
    if (child.type === "element" && !skipped(child)) wrap(child);
    children.push(child);
  }
  if (changed) parent.children = children;
}

/** Rehype plugin; run it after rehype-katex so formulas are already marked. */
export function rehypeNoteDigits() {
  return (tree: Root) => wrap(tree);
}

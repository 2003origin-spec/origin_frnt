import test from "node:test";
import assert from "node:assert/strict";

import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { normaliseDisplayMath, remarkNoteBoxes } from "../../src/lib/notes/markdown-boxes";
import { rehypeNoteDigits, splitDigits } from "../../src/lib/notes/note-digits";
import { parseFrontMatter, frontMatterList, frontMatterString } from "../../src/lib/notes/front-matter";
import { analyseNoteMarkdown } from "../../src/server/notes/markdown-validate";

/** Same plugin order as the NotesMarkdown renderer, minus KaTeX rendering. */
function toHtml(markdown: string): string {
  return String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkDirective)
      .use(remarkNoteBoxes)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  );
}

const SAMPLE = `## Projectile motion

:::formula{title="Time of flight"}
$$T = \\frac{2u\\sin\\theta}{g}$$
$u$ = launch speed
:::

:::trap
Only when it lands at the **same height**.
:::

:::question{exam="NEET"}
Find the range for $u = 20$ m/s at 30°.

---

$R = 20\\sqrt{3}$ m
:::
`;

test("the Appendix B sample note has no errors and renders its boxes", () => {
  const analysis = analyseNoteMarkdown(SAMPLE);
  assert.deepEqual(analysis.errors, []);
  assert.deepEqual(analysis.warnings, []);
  assert.match(analysis.plainText, /Projectile motion/u);
  assert.match(analysis.plainText, /launch speed/u);
  assert.match(analysis.plainText, /Time of flight/u, "box titles are searchable");
  assert.doesNotMatch(analysis.plainText, /\\frac/u, "formula source stays out of search previews");

  const html = toHtml(SAMPLE);
  assert.match(html, /<div data-note-box="formula" data-title="Time of flight">/u);
  assert.match(html, /<div data-note-box="trap">/u);
  assert.match(html, /<div data-note-box="question" data-exam="NEET"><div data-note-part="question">/u);
  assert.match(html, /<div data-note-part="answer">/u);
});

test("a formula KaTeX cannot compile is an error with its line number", () => {
  const analysis = analyseNoteMarkdown("Line one\n\n$\\frac{1}{$ broken\n");
  assert.equal(analysis.errors.length, 1);
  assert.equal(analysis.errors[0].line, 3);
  assert.match(analysis.errors[0].message, /^Formula error/u);
});

test("chemistry equations through mhchem compile", () => {
  assert.deepEqual(analyseNoteMarkdown("$\\ce{2H2 + O2 -> 2H2O}$").errors, []);
});

test("unknown boxes and raw HTML are errors", () => {
  const unknown = analyseNoteMarkdown(":::warning\nCareful\n:::\n");
  assert.match(unknown.errors[0]?.message ?? "", /Unknown box ":::warning"/u);
  const html = analyseNoteMarkdown("<script>alert(1)</script>\n");
  assert.match(html.errors[0]?.message ?? "", /Raw HTML/u);
  // …and the renderer escapes it anyway.
  assert.doesNotMatch(toHtml("<script>alert(1)</script>\n"), /<script>/u);
});

test("a question without an answer separator is a warning, not an error", () => {
  const analysis = analyseNoteMarkdown(":::question\nWhat is g?\n:::\n");
  assert.deepEqual(analysis.errors, []);
  assert.match(analysis.warnings[0]?.message ?? "", /no --- line/u);
});

test("--- right under the question text still splits off the answer", () => {
  const markdown = ":::question\nWhat is g?\n---\nAbout 9.8 m/s²\n:::\n";
  assert.deepEqual(analyseNoteMarkdown(markdown).warnings, []);
  const html = toHtml(markdown);
  assert.match(html, /<div data-note-part="question"><p>What is g\?<\/p><\/div><div data-note-part="answer"><p>About 9.8 m\/s²<\/p>/u);
  assert.doesNotMatch(html, /<h2>/u);
});

test("colons in ordinary text are not eaten as directives", () => {
  const html = toHtml("Ans:A and ratio 3:x, see ::note too\n");
  assert.match(html, /Ans:A/u);
  assert.match(html, /3:x/u);
});

test("front matter: strings, quotes and lists", () => {
  const parsed = parseFrontMatter(`---
title: "Motion in a Plane: Formula Sheet"
type: formula_sheet
exams: [jee, neet]
chapter: c11.physics.motion-in-a-plane
---

## Body
`);
  assert.deepEqual(parsed.errors, []);
  assert.equal(frontMatterString(parsed.data, "title"), "Motion in a Plane: Formula Sheet");
  assert.equal(frontMatterString(parsed.data, "type"), "formula_sheet");
  assert.deepEqual(frontMatterList(parsed.data, "exams"), ["jee", "neet"]);
  assert.equal(parsed.body, "## Body\n");
  assert.equal(parsed.bodyLine, 8);
});

test("front matter: missing closing line is reported", () => {
  const parsed = parseFrontMatter("---\ntitle: x\n\nbody");
  assert.equal(parsed.errors.length, 1);
});

test("a line that is only $$…$$ becomes a display formula; inline and code uses stay", () => {
  const md = "$$T = \\frac{2u}{g}$$\nwhere $u$ is speed and $$x$$ inline\n```\n$$not maths$$\n```";
  const out = normaliseDisplayMath(md);
  assert.equal(out.split("\n").slice(0, 3).join("|"), "$$|T = \\frac{2u}{g}|$$");
  assert.match(out, /and \$\$x\$\$ inline/u);
  assert.match(out, /```\n\$\$not maths\$\$\n```/u);
  const html = toHtml(out);
  assert.match(html, /math-display/u);
});

test("digits split out of text, keeping everything else", () => {
  assert.deepEqual(splitDigits("F1 gives 3:1"), [
    { text: "F", digits: false },
    { text: "1", digits: true },
    { text: " gives ", digits: false },
    { text: "3", digits: true },
    { text: ":", digits: false },
    { text: "1", digits: true },
  ]);
  assert.deepEqual(splitDigits("no digits"), [{ text: "no digits", digits: false }]);
});

test("digits in note text get the readable-digit span; formulas and code do not", () => {
  const html = String(
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex)
      .use(rehypeNoteDigits)
      .use(rehypeStringify)
      .processSync("F1 gives 3 : 1, with $x^2 + 10$ and `a1` left alone."),
  );
  assert.equal(html.match(/class="note-num"/gu)?.length, 3);
  assert.match(html, /F<span class="note-num">1<\/span> gives <span class="note-num">3<\/span> : <span class="note-num">1<\/span>,/u);
  assert.match(html, /<code>a1<\/code>/u);
});

test("a macro-bomb formula is refused quickly instead of freezing the reader", () => {
  const bomb = "$$\\def\\a{" + "x".repeat(200) + "}" + "\\a".repeat(999) + "$$";
  const started = Date.now();
  const analysis = analyseNoteMarkdown(bomb);
  assert.ok(Date.now() - started < 2000, "checked in well under 2 s");
  assert.equal(analysis.errors.length, 1);
  assert.match(analysis.errors[0].message, /Too many expansions/u);
});

test("huge sizes in a formula are capped", () => {
  const analysis = analyseNoteMarkdown("$\\rule{1em}{100000em}$");
  assert.equal(analysis.errors.length, 0, "KaTeX caps the size instead of failing");
  const html = String(
    unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeKatex, { strict: "ignore", maxExpand: 100, maxSize: 10 }).use(rehypeStringify).processSync("$\\rule{1em}{100000em}$"),
  );
  assert.doesNotMatch(html, /border-top-width:100000em/u, "the drawn rule is capped at maxSize");
  assert.match(html, /border-top-width:10em/u);
});

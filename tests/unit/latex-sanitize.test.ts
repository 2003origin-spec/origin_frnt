import test from "node:test";
import assert from "node:assert/strict";
import katex from "katex";

import {
  repairMathTex,
  repairMathSpans,
  decodeEscapedWhitespace,
  collapseDollarRuns,
} from "../../src/lib/latex-sanitize";

/** Asserts KaTeX renders the (repaired) tex without throwing. */
function assertRenders(tex: string, display = false) {
  const repaired = repairMathTex(tex);
  assert.doesNotThrow(
    () => katex.renderToString(repaired, { displayMode: display, throwOnError: true, strict: false }),
    `KaTeX still threw on repaired «${repaired}» (from «${tex}»)`,
  );
}

// ── The five real-world failure modes found in production content ─────────────

test("repairs stray percent (KaTeX comment) so text renders", () => {
  // Raw `%` is a KaTeX comment and throws — this is the production bug.
  assert.throws(() => katex.renderToString("\\text{50% of students}", { throwOnError: true }));
  // Repaired, it renders.
  assertRenders("\\text{50% of students}");
  assertRenders("20% w/w yield");
  assert.equal(repairMathTex("\\text{50% of students}").includes("\\%"), true);
});

test("does not double-escape an already-escaped percent (idempotent)", () => {
  const once = repairMathTex("50\\% yield");
  assert.equal(once, repairMathTex(once));
  assert.equal((once.match(/\\%/g) ?? []).length, 1);
});

test("balances truncated braces", () => {
  assertRenders("\\frac{1}{2");
  assertRenders("\\sqrt{x + 1");
  assert.equal(repairMathTex("\\frac{1}{2"), "\\frac{1}{2}");
});

test("drops stray closing brace", () => {
  assertRenders("x + 1}");
  assert.equal(repairMathTex("x}"), "x");
});

test("remaps display-only environments to inline-safe equivalents", () => {
  assertRenders("\\begin{align} a &= b \\\\ c &= d \\end{align}");
  assertRenders("\\begin{gather} a \\\\ b \\end{gather}");
  assertRenders("\\begin{equation} E = mc^2 \\end{equation}");
  const out = repairMathTex("\\begin{align} a &= b \\end{align}");
  assert.match(out, /\\begin\{aligned\}/);
  assert.match(out, /\\end\{aligned\}/);
});

test("strips inline-hostile \\tag and \\label", () => {
  assertRenders("E = mc^2 \\tag{1}");
  assertRenders("x = y \\label{eq:foo}");
  assert.equal(repairMathTex("E = mc^2 \\tag{1}").includes("\\tag"), false);
});

test("collapses doubled-backslash command artifacts outside environments", () => {
  assertRenders("30^\\\\circ");
  assertRenders("\\\\pi/6");
  assertRenders("2 \\\\times 30^\\\\circ = 60^\\\\circ");
  assert.equal(repairMathTex("30^\\\\circ"), "30^\\circ");
});

test("keeps \\\\ row separators inside a matrix/aligned environment", () => {
  const tex = "\\begin{matrix} a \\\\ b \\end{matrix}";
  assert.equal(repairMathTex(tex), tex);
  assertRenders(tex);
});

test("strips a dangling trailing backslash", () => {
  assertRenders("i = \\frac{3.72}{1.86} = 2\\");
  assert.equal(repairMathTex("x = 2\\"), "x = 2");
});

test("escapes a lone alignment ampersand outside an environment", () => {
  assertRenders("x & y");
  assert.equal(repairMathTex("x & y"), "x \\& y");
});

test("keeps ampersands inside a matrix/aligned environment untouched", () => {
  const tex = "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}";
  assert.equal(repairMathTex(tex), tex);
  assertRenders(tex);
});

test("balances unmatched \\left / \\right", () => {
  assertRenders("\\left( x + 1");
  assertRenders("x + 1 \\right)");
  assert.match(repairMathTex("\\left( x"), /\\right\./);
});

test("auto-closes a truncated environment", () => {
  assertRenders("\\begin{matrix} a & b");
  assert.match(repairMathTex("\\begin{matrix} a & b"), /\\end\{matrix\}/);
});

// ── Literal escape decoding (OG-code "\n" / "$$$" artifacts) ──────────────────

test("decodes literal \\n / \\t / \\r into real whitespace", () => {
  // In JS source, "\\n" is the two chars backslash+n — the literal escape.
  assert.equal(decodeEscapedWhitespace("Line1\\nLine2"), "Line1\nLine2");
  assert.equal(decodeEscapedWhitespace("a\\n\\nb"), "a\n\nb");
  assert.equal(decodeEscapedWhitespace("\\nSince energy is conserved"), "\nSince energy is conserved");
  assert.equal(decodeEscapedWhitespace("col1\\tcol2"), "col1\tcol2");
  assert.equal(decodeEscapedWhitespace("x\\n1"), "x\n1");
});

test("does NOT mangle real LaTeX commands starting with n/t/r", () => {
  for (const cmd of ["\\nabla f", "a \\neq b", "\\nu", "\\ne", "\\ni", "\\text{x}", "\\times", "\\theta", "\\tan x", "\\to", "\\tau", "\\rho", "\\right)", "\\rightarrow x"]) {
    assert.equal(decodeEscapedWhitespace(cmd), cmd, `mangled ${cmd}`);
  }
  // Uppercase-continuing real commands stay intact too.
  assert.equal(decodeEscapedWhitespace("\\nRightarrow"), "\\nRightarrow");
  assert.equal(decodeEscapedWhitespace("\\rVert"), "\\rVert");
});

test("collapses malformed multi-dollar runs to $$", () => {
  assert.equal(collapseDollarRuns("$$$x$$$"), "$$x$$");
  assert.equal(collapseDollarRuns("$$$$y$$$$"), "$$y$$");
  assert.equal(collapseDollarRuns("$$a$$"), "$$a$$"); // untouched
  assert.equal(collapseDollarRuns("$5 and $6"), "$5 and $6"); // untouched
});

// ── Must NOT corrupt already-valid LaTeX ──────────────────────────────────────

const VALID = [
  "\\frac{d}{dx}\\left(\\frac{x^2+1}{x-1}\\right)",
  "2H_2 + O_2 \\rightarrow 2H_2O",
  "\\begin{cases} x+y=2 \\\\ x-y=0 \\end{cases}",
  "\\displaystyle \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1",
  "\\vec{F} = m\\vec{a}",
  "x \\in \\mathbb{R}, f \\in \\mathcal{F}",
  "a_{n+1} = a_n + d",
  "\\cfrac{1}{1+\\cfrac{1}{1+x}}",
];

for (const tex of VALID) {
  test(`valid LaTeX is preserved & idempotent: ${tex.slice(0, 32)}`, () => {
    assertRenders(tex, true);
    assert.equal(repairMathTex(tex), repairMathTex(repairMathTex(tex)), "not idempotent");
  });
}

// ── repairMathSpans only touches math, never surrounding prose ────────────────

test("repairMathSpans leaves currency and literal percent outside math untouched", () => {
  const input = "The price rose from $5 to $10 (a 100% increase).";
  // No math spans that need repair here → percent outside a $…$ pair stays literal.
  assert.equal(repairMathSpans(input).includes("100\\%"), false);
});

test("repairMathSpans repairs the interior of an inline span only", () => {
  const out = repairMathSpans("Yield was $\\text{50% of theoretical}$ today.");
  assert.match(out, /\\%/);
  assert.match(out, /Yield was \$/);
  assert.match(out, /\$ today\./);
});

test("repairMathSpans handles display spans", () => {
  const out = repairMathSpans("$$\\begin{align} a &= b \\end{align}$$");
  assert.match(out, /\\begin\{aligned\}/);
});

test("repairMathSpans is a no-op on strings without $", () => {
  const input = "Plain prose with no math at all.";
  assert.equal(repairMathSpans(input), input);
});

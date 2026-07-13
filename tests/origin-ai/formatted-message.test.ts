import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDelimiters } from "../../src/components/origin-ai/FormattedMessage";

test("does not wrap trig-function substrings inside subject definitions", () => {
  const normalized = normalizeDelimiters(
    "where C-capacitance, R-resistance, l-length, E-Electric field",
  );

  assert.equal(normalized, "where C-capacitance, R-resistance, l-length, E-Electric field");
});

test("does not wrap OCR-split resistance or capacitance fragments", () => {
  const normalized = normalizeDelimiters("R-resis tance and C-capaci tance are defined");

  assert.equal(normalized, "R-resis tance and C-capaci tance are defined");
});

test("does not wrap math function names used as ordinary text", () => {
  const normalized = normalizeDelimiters("tan can be written as a ratio in trigonometry");

  assert.equal(normalized, "tan can be written as a ratio in trigonometry");
});

test("wraps real inline equations and math functions", () => {
  const normalized = normalizeDelimiters(
    String.raw`x = 1/\sqrt{\mu_0\epsilon_0}, y = E/B and z = 1/CR; use tan(theta) and log_10 x.`,
  );

  assert.match(normalized, /\$x = 1\/\\sqrt\{\\mu_0\\epsilon_0\}\$/);
  assert.match(normalized, /\$y = E\/B\$/);
  assert.match(normalized, /\$z = 1\/CR\$/);
  assert.match(normalized, /\$tan\(theta\)\$/);
  assert.match(normalized, /\$log_10 x\$/);
});

test("wraps bracketed dimension equations as complete math spans", () => {
  const normalized = normalizeDelimiters(
    String.raw`If [S] = [\alpha^2] \times [S], then [\alpha^2] must be dimensionless.`,
  );

  assert.match(normalized, /\$\[S\] = \[\\alpha\^2\] \\times \[S\]\$/);
  assert.match(normalized, /\$\[\\alpha\^2\]\$/);
  assert.doesNotMatch(normalized, /\$\\times\$/);
});

test("keeps bracketed variables with postfix exponents in the same span", () => {
  const normalized = normalizeDelimiters(
    String.raw`If [S] = [\alpha]^2 \times [S], then [\beta]^2 = [M^2L^4T^{-4}K^{-2}].`,
  );

  assert.match(normalized, /\$\[S\] = \[\\alpha\]\^2 \\times \[S\]\$/);
  assert.match(normalized, /\$\[\\beta\]\^2 = \[M\^2L\^4T\^\{-4\}K\^\{-2\}\]\$/);
  assert.doesNotMatch(normalized, /\$\[\\alpha\]\$\^2/);
});

test("keeps full bracketed dimension units together", () => {
  const normalized = normalizeDelimiters(
    String.raw`Energy per mole per Kelvin = [M L^2T^{-2}K^{-1}mol^{-1}] [J] = mechanical equivalent.`,
  );

  assert.match(normalized, /\$\[M L\^2T\^\{-2\}K\^\{-1\}mol\^\{-1\}\] \[J\]\$/);
  assert.doesNotMatch(normalized, /\[M \$L\^2/);
});

test("does not treat ordinary bracketed prose as math", () => {
  const normalized = normalizeDelimiters("Reference [see also] remains text.");

  assert.equal(normalized, "Reference [see also] remains text.");
});

test("decodes literal \\n escapes instead of manufacturing $$$ runs (OG-code explanations)", () => {
  // Real production shape: literal "\n" escapes around $$…$$ blocks.
  const normalized = normalizeDelimiters(
    "energy is conserved:\\n$$\\text{Loss in PE} = \\text{Gain in KE}$$\\n$$Mg(h_i - h_f) = \\frac{1}{2} I \\omega^2$$\\n\\nHere the moment of inertia",
  );

  // No manufactured 3+ dollar runs.
  assert.doesNotMatch(normalized, /\${3,}/);
  // The literal "\n" escapes became real newlines, not "\n" LaTeX commands
  // (so nothing like "\nHere" or "$\n$" survives).
  assert.doesNotMatch(normalized, /\\n[A-Za-z0-9]/);
  assert.match(normalized, /conserved:\n\$\$/);
  // Both display blocks survive intact, promoted onto their own fenced lines
  // (same-line "$$eq$$" only renders as KaTeX *display* math, with proper
  // overflow handling, once the fences are on their own line — see the
  // "promotes same-line display equations" tests below).
  assert.match(normalized, /\$\$\n\\text\{Loss in PE\} = \\text\{Gain in KE\}\n\$\$/);
  assert.match(normalized, /Mg\(h_i - h_f\) = \\frac\{1\}\{2\} I \\omega\^2/);
});

// ── wrapBareLaTeX over-wrapping markdown structure ─────────────────────────
// wrapBareLaTeX misread markdown syntax (bold markers, "Step N:" headings,
// ordered-list markers) as math signals because its lookahead/operator
// detection didn't stop at "$" or "*" boundaries. All cases below are taken
// from (or modeled directly on) real production explanations that were
// jamming in the OG-code practice UI.

test("does not wrap a bare digit in a bold 'Step N:' heading", () => {
  const normalized = normalizeDelimiters(
    "**Step 1: Find the Angular Speed ($\\omega$) using Conservation of Energy**",
  );

  assert.doesNotMatch(normalized, /\$1\$/);
  assert.match(
    normalized,
    /^\*\*Step 1: Find the Angular Speed \(\$\\omega\$\) using Conservation of Energy\*\*$/,
  );
});

test("does not eat the closing bold marker after a short word", () => {
  const normalized = normalizeDelimiters(
    "using Newton's Second Law**\nLet's analyze the torque.",
  );

  assert.doesNotMatch(normalized, /\$Law/);
  assert.match(normalized, /Second Law\*\*\nLet's analyze/);
});

test("does not swallow a bold phrase after a short lead-in word", () => {
  const normalized = normalizeDelimiters(
    "the triangle is **non-right-angled**! So, $P \\neq 60^\\circ$.",
  );

  assert.match(normalized, /is \*\*non-right-angled\*\*! So, \$P \\neq 60\^\\circ\$\./);
});

test("does not wrap ordered-list markers as math", () => {
  const normalized = normalizeDelimiters(
    "components:\n1. Radial acceleration ($a_r = \\frac{3g}{4}$ pointing along the rod).\n2. Tangential acceleration.",
  );

  assert.match(normalized, /\n1\. Radial acceleration/);
  assert.match(normalized, /\n2\. Tangential acceleration\./);
  assert.doesNotMatch(normalized, /\$1\$|\$2\$/);
});

test("does not wrap digits inside a bold chemistry/biology term", () => {
  // Real production shapes (biology explanations, zero real LaTeX in either).
  const a = normalizeDelimiters(
    "1. **Definition of a Monosaccharide:** A monosaccharide is the most basic unit.\n2. **Classification by carbon count:**\n   - A **Pentose** is a 5-carbon monosaccharide.",
  );
  assert.doesNotMatch(a, /\$1\$|\$2\$/);
  assert.doesNotMatch(a, /\$A \*\*Pentose\*\*\$/);

  const b = normalizeDelimiters(
    "The first true restriction endonuclease was isolated by **Hamilton O. Smith** and his colleagues in 1970.",
  );
  assert.doesNotMatch(b, /\$/); // zero real math in this sentence — nothing should be wrapped
});

test("never manufactures a $$$ run when a wrap would abut real display math", () => {
  const normalized = normalizeDelimiters(
    "the world of **$$\\alpha$$-halogenation** of ketones",
  );

  assert.doesNotMatch(normalized, /\${3,}/);
});

test("promotes same-line display equations onto their own fenced lines", () => {
  const normalized = normalizeDelimiters(
    "conserved:\n$$Mg(h_i - h_f) = \\frac{1}{2} I \\omega^2$$\nHere",
  );

  assert.match(normalized, /conserved:\n\$\$\nMg\(h_i - h_f\) = \\frac\{1\}\{2\} I \\omega\^2\n\$\$\nHere/);
});

test("does not promote a mid-sentence $$...$$ to its own lines", () => {
  const normalized = normalizeDelimiters("The product ($$\\text{NaOH}$$) is a strong base.");

  assert.match(normalized, /The product \(\$\$\\text\{NaOH\}\$\$\) is a strong base\./);
});

test("converts \\[...\\] to real display math, not single-dollar inline", () => {
  const normalized = normalizeDelimiters("\\[E=mc^2\\]");

  assert.match(normalized, /\$\$\nE=mc\^2\n\$\$/);
  assert.doesNotMatch(normalized, /^\$E=mc\^2\$$/m);
});

// Regression: a decimal point used to stop the bare-math consume loop dead
// (it wasn't in the digit/operator character set), splitting "19.6" into two
// separate wraps around a literal ".", e.g. "$m = ... = 19$.$6$" — visibly
// broken in the rendered output (a bare "." floating between two equations).
test("keeps a decimal number in a bare-math span as one unbroken wrap", () => {
  const normalized = normalizeDelimiters(String.raw`m = \frac{196}{10} = 19.6\ \mathrm{kg}`);

  assert.match(normalized, /^\$m = \\frac\{196\}\{10\} = 19\.6\\ \\mathrm\{kg\}\$$/);
});

// Regression: "\ " (LaTeX's explicit-space command, ubiquitous before units)
// wasn't recognised by the command-word matcher (it only matched "\" + a
// letter), so it stopped the span and left a stray bare "\" in the markdown
// source, splitting e.g. "6.4 \times 10^6\ \mathrm{m}" into two wraps.
test("keeps an explicit LaTeX space command (\\ ) inside its math span", () => {
  const normalized = normalizeDelimiters(String.raw`R = 6400\ \mathrm{km} = 6.4 \times 10^6\ \mathrm{m}`);

  assert.match(normalized, /^\$R = 6400\\ \\mathrm\{km\} = 6\.4 \\times 10\^6\\ \\mathrm\{m\}\$$/);
});

// Regression: a short-word-plus-operator entry trigger could, via the
// "allow a single word after a space when it looks math-adjacent" rule,
// chain across an entire sentence of ordinary prose — KaTeX still "renders"
// a long run of bare letters (as implicitly-multiplied italic variables),
// silently swallowing every space, e.g. "2.At the equator, the effective
// acceleration..." → "2.Attheequator,theeffectiveacceleration...".
test("does not wrap a long run of ordinary prose even if it starts near an operator", () => {
  const normalized = normalizeDelimiters(
    "2. At the equator, the effective acceleration due to gravity is reduced by the centripetal term:",
  );

  assert.equal(
    normalized,
    "2. At the equator, the effective acceleration due to gravity is reduced by the centripetal term:",
  );
});

// The KaTeX-validation safety net (repairMathSpans, in latex-sanitize.ts):
// a span that is still invalid LaTeX even after repairMathTex's fixed rule
// set — some malformation outside what those rules cover — used to fall
// through to rehype-katex's own red `.katex-error` fallback. It must instead
// degrade to plain, delimiter-free text so students never see a raw parse
// error, regardless of what specifically broke.
test("degrades an unrepairable math span to plain text instead of leaving it for KaTeX's red error fallback", () => {
  const normalized = normalizeDelimiters("The result is $\\frobnicate{x} + 1$ which is undefined.");

  assert.equal(normalized, "The result is \\frobnicate{x} + 1 which is undefined.");
});

test("still wraps and preserves genuinely valid LaTeX after the validation safety net", () => {
  const normalized = normalizeDelimiters("Valid math stays untouched: $E = mc^2$.");

  assert.equal(normalized, "Valid math stays untouched: $E = mc^2$.");
});

// The exact multi-equation sentence from the reported bug (item 3/4 of a
// "Diagnostic Insight" panel): four well-formed $...$ pairs interleaved with
// prose and a "4." that could be mistaken for part of the previous equation.
// All four must render, none should be rejected by the validation net.
test("preserves multiple well-formed equations interleaved with prose and a numbered continuation", () => {
  const input =
    "3. The angular velocity is $\\omega = \\frac{2\\pi}{T}$, where the period is " +
    "$T = 24\\ \\mathrm{hours}$. 4. Next term $R\\omega^2$ (using $\\pi^2 \\approx 10$):";
  const normalized = normalizeDelimiters(input);

  assert.equal(normalized, input);
});

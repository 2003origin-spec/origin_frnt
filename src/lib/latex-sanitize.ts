/**
 * latex-sanitize — best-effort repair layer that makes arbitrary, messy LaTeX
 * survive KaTeX without throwing.
 *
 * Question / explanation text on Origin comes from OCR, AI generation, teacher
 * paste, and legacy imports. It frequently contains patterns that are *valid
 * intent* but *invalid KaTeX*, which KaTeX renders as an ugly red error string
 * for students. This module rewrites the common offenders into equivalent
 * KaTeX-safe source so the math renders instead of erroring.
 *
 * Design rules:
 *  • Pure string → string. No DOM, no React — safe on server and client.
 *  • Idempotent: repair(repair(x)) === repair(x).
 *  • Conservative: never change the *meaning* of already-valid LaTeX; only
 *    neutralise things that would otherwise throw.
 *
 * It is applied at two chokepoints:
 *  • FormattedMessage.normalizeDelimiters — repairs the interior of every
 *    `$…$` / `$$…$$` span before remark-math/rehype-katex sees it.
 *  • LatexRenderer.renderKatex — repairs each segment before katex.renderToString.
 */

// ── Decode literal escape sequences ("\n", "\t", "\r") ────────────────────────
// OG-code / AI content frequently arrives with *literal* two-character escape
// sequences (a backslash followed by `n`/`t`/`r`) instead of real whitespace —
// a JSON-decoding artifact from the import pipeline. Left as-is, the delimiter
// wrapper (`wrapBareLaTeX`) mistakes each `\n` for a LaTeX command and wraps it
// in `$…$`, which then collides with adjacent real `$$…$$` blocks to manufacture
// `$$$` runs that KaTeX/remark-math cannot parse. Decoding must therefore run
// *before* any delimiter wrapping.
//
// The tricky part is not clobbering genuine LaTeX commands that start with
// n/t/r (`\nabla`, `\text`, `\times`, `\rho`, `\right`, …). We distinguish them
// with an explicit whitelist of KaTeX-supported n/t/r control words: if the full
// letter-run is a known command it is left untouched, otherwise the leading
// `\n`/`\t`/`\r` is treated as a literal escape and decoded ("\nSince" → newline
// + "Since", "\n\nHere" → two newlines + "Here").
const KNOWN_NTR_COMMANDS = new Set([
  // n
  'nabla', 'natural', 'ncong', 'ne', 'nearrow', 'neg', 'negthickspace',
  'negthinspace', 'negmedspace', 'neq', 'nequiv', 'newline', 'nexists', 'ngeq',
  'ngeqq', 'ngeqslant', 'ngtr', 'ni', 'nleftarrow', 'nLeftarrow',
  'nleftrightarrow', 'nLeftrightarrow', 'nleq', 'nleqq', 'nleqslant', 'nless',
  'nmid', 'nobreakspace', 'nolimits', 'nonumber', 'normalsize', 'not', 'notin',
  'notni', 'nparallel', 'nprec', 'npreceq', 'nrightarrow', 'nRightarrow',
  'nshortmid', 'nshortparallel', 'nsim', 'nsubseteq', 'nsubseteqq', 'nsucc',
  'nsucceq', 'nsupseteq', 'nsupseteqq', 'ntriangleleft', 'ntrianglelefteq',
  'ntriangleright', 'ntrianglerighteq', 'nu', 'nvdash', 'nvDash', 'nVdash',
  'nVDash', 'nwarrow',
  // t
  'tan', 'tanh', 'tau', 'tbinom', 'text', 'textbf', 'textcolor', 'textit',
  'textmd', 'textnormal', 'textrm', 'textsf', 'textstyle', 'texttt', 'textup',
  'tfrac', 'therefore', 'theta', 'thetasym', 'thickapprox', 'thickspace',
  'thinspace', 'tilde', 'times', 'tiny', 'to', 'top', 'triangle', 'triangledown',
  'triangleleft', 'trianglelefteq', 'triangleq', 'triangleright',
  'trianglerighteq', 'tt', 'twoheadleftarrow', 'twoheadrightarrow',
  // r
  'rangle', 'rbrace', 'rbrack', 'rceil', 'real', 'restriction', 'rfloor',
  'rgroup', 'rho', 'right', 'rightarrow', 'rightarrowtail', 'rightharpoondown',
  'rightharpoonup', 'rightleftarrows', 'rightleftharpoons', 'rightrightarrows',
  'rightsquigarrow', 'rightthreetimes', 'risingdotseq', 'rlap', 'rmoustache',
  'root', 'rq', 'rtimes', 'rvert', 'rVert',
]);

const ESCAPE_WHITESPACE: Record<string, string> = { n: '\n', t: '\t', r: '\r' };

export function decodeEscapedWhitespace(input: string): string {
  if (!input || input.indexOf('\\') === -1) return input;
  return input.replace(/\\([ntr])([A-Za-z]*)/g, (match, ch: string, rest: string) => {
    // A known LaTeX command (\nabla, \text, \rho, \rightarrow, …) is kept verbatim.
    if (KNOWN_NTR_COMMANDS.has(ch + rest)) return match;
    // Otherwise the leading \n/\t/\r is a literal escape: decode it and keep any
    // trailing letters as ordinary text.
    return ESCAPE_WHITESPACE[ch] + rest;
  });
}

// ── Collapse malformed multi-dollar delimiter runs ────────────────────────────
// `$$$`, `$$$$`, … are never valid math delimiters; remark-math/KaTeX cannot pair
// them, so the whole span falls out as raw text. Collapse any run of 3+ dollars
// to a display `$$`. (A function replacement avoids the `$$`→`$` substitution
// footgun in String.replace patterns.)
export function collapseDollarRuns(input: string): string {
  if (!input || input.indexOf('$') === -1) return input;
  return input.replace(/\${3,}/g, () => '$$');
}

// ── Display-only environments → inline-safe equivalents ───────────────────────
// align / gather / equation / eqnarray / multline only work in *display* mode
// and throw ("can be used only in display mode") when they land in an inline
// `$…$`. Their `aligned` / `gathered` cousins render in either mode, so we remap
// unconditionally (they render identically in display mode too, just without the
// auto equation number — irrelevant for exam content).
const ENVIRONMENT_REMAP: Record<string, string> = {
  align: 'aligned',
  'align*': 'aligned',
  alignat: 'alignedat',
  'alignat*': 'alignedat',
  eqnarray: 'aligned',
  'eqnarray*': 'aligned',
  gather: 'gathered',
  'gather*': 'gathered',
  multline: 'gathered',
  'multline*': 'gathered',
  equation: 'aligned',
  'equation*': 'aligned',
  split: 'aligned',
};

// Environments in which `&` is a legitimate column/alignment separator and must
// NOT be escaped. Anything remapped above collapses to one of these names.
const TABULAR_ENVIRONMENTS = new Set([
  'aligned',
  'alignedat',
  'gathered',
  'array',
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'smallmatrix',
  'cases',
  'dcases',
  'rcases',
  'subarray',
  'CD',
]);

function remapDisplayOnlyEnvironments(tex: string): string {
  return tex.replace(
    /\\(begin|end)(\s*)\{([a-zA-Z]+\*?)\}/g,
    (match, kind: string, gap: string, env: string) => {
      const replacement = ENVIRONMENT_REMAP[env];
      return replacement ? `\\${kind}${gap}{${replacement}}` : match;
    },
  );
}

// ── Strip inline-hostile numbering/label commands ─────────────────────────────
// `\tag`, `\tag*`, `\label` only work in display equations; `\notag` / `\nonumber`
// are no-ops outside them. Remove them so inline math doesn't throw.
function stripEquationNumbering(tex: string): string {
  return tex
    .replace(/\\(?:tag|label)\*?\s*\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\\(?:notag|nonumber)\b/g, '');
}

// ── Escape stray percent signs ────────────────────────────────────────────────
// KaTeX (like TeX) treats an unescaped `%` as a line comment, silently eating
// the rest of the input — the #1 cause of "Unexpected end of input" on exam
// text like `\text{50% yield}` or `20% w/w`. In our content `%` always means
// "percent", so escape any `%` not already backslash-escaped.
function escapePercent(tex: string): string {
  return tex.replace(/(^|[^\\])%/g, '$1\\%');
}

// ── Balance braces ────────────────────────────────────────────────────────────
// Drops stray `}` and appends any missing `}` so a truncated `\frac{1}{2` or a
// dangling group renders instead of throwing. Escaped `\{` / `\}` are ignored.
function balanceBraces(tex: string): string {
  let depth = 0;
  let out = '';
  for (let i = 0; i < tex.length; i += 1) {
    const ch = tex[i];
    if (ch === '\\') {
      // Copy the command/escape char verbatim; it never affects brace depth.
      out += ch + (tex[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      out += ch;
      continue;
    }
    if (ch === '}') {
      if (depth === 0) continue; // stray closer → drop
      depth -= 1;
      out += ch;
      continue;
    }
    out += ch;
  }
  if (depth > 0) out += '}'.repeat(depth);
  return out;
}

// ── Balance \left … \right ────────────────────────────────────────────────────
// An unmatched `\left(` (or a lone `\right)`) throws "Expected \right". Pad with
// the null delimiter `\left.` / `\right.` so truncated groups still render.
function balanceLeftRight(tex: string): string {
  const lefts = (tex.match(/\\left(?![a-zA-Z])/g) ?? []).length;
  const rights = (tex.match(/\\right(?![a-zA-Z])/g) ?? []).length;
  if (lefts > rights) return tex + '\\right.'.repeat(lefts - rights);
  if (rights > lefts) return '\\left.'.repeat(rights - lefts) + tex;
  return tex;
}

// ── Auto-close truncated environments ─────────────────────────────────────────
// A `\begin{matrix}` with no `\end{matrix}` (common OCR truncation) throws.
// Append the missing `\end{…}` for each unbalanced environment name.
function balanceEnvironments(tex: string): string {
  const counts = new Map<string, number>();
  const re = /\\(begin|end)\s*\{([a-zA-Z]+\*?)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tex)) !== null) {
    const [, kind, env] = m;
    counts.set(env, (counts.get(env) ?? 0) + (kind === 'begin' ? 1 : -1));
  }
  let out = tex;
  for (const [env, delta] of counts) {
    if (delta > 0) out += `\\end{${env}}`.repeat(delta);
  }
  return out;
}

// ── Escape stray alignment ampersands ─────────────────────────────────────────
// Outside a tabular/alignment environment a bare `&` throws
// ("Expected 'EOF', got '&'"). If the segment has no environment that gives `&`
// meaning, treat it as a literal ampersand (`\&`). Inside such an environment
// (matrix, aligned, cases, …) `&` is left untouched.
function hasTabularEnvironment(tex: string): boolean {
  return [...tex.matchAll(/\\begin\s*\{([a-zA-Z]+\*?)\}/g)].some(
    ([, env]) => TABULAR_ENVIRONMENTS.has(env),
  );
}

function escapeStrayAmpersands(tex: string): string {
  if (hasTabularEnvironment(tex)) return tex;
  return tex.replace(/(^|[^\\])&/g, '$1\\&');
}

// ── Collapse doubled-backslash command artifacts ("\\circ" → "\circ") ─────────
// The OG-code import double-escaped many commands, so `\pi`/`\circ`/`\times`
// arrive as `\\pi`/`\\circ`/`\\times`. KaTeX reads `\\` as a line break, so
// `$30^\\circ$` throws and `$\\pi$` renders a stray break + the letters "pi".
// A genuine inline line break `\\` is followed by whitespace, `[`, `*` or end —
// never a letter — so outside a tabular/alignment environment (where `\\` is a
// legitimate row separator) we collapse `\\`+letter back to `\`+letter.
function collapseDoubledBackslashCommands(tex: string): string {
  if (hasTabularEnvironment(tex)) return tex;
  return tex.replace(/\\\\(?=[a-zA-Z])/g, '\\');
}

// ── Strip a dangling trailing backslash ───────────────────────────────────────
// A lone `\` at the very end of a segment (a truncation artifact, e.g. "= 2\")
// throws "Unexpected character '\'". A genuine "\\" line break is left intact.
function stripDanglingBackslash(tex: string): string {
  return tex.replace(/(?<!\\)\\\s*$/, '');
}

/**
 * Repair a single math body (the text *between* `$…$` delimiters, no delimiters
 * included) into KaTeX-safe source. Order matters: environment remapping runs
 * first so `&`-detection sees the collapsed names.
 */
export function repairMathTex(tex: string): string {
  if (!tex) return tex;
  let out = tex;
  out = remapDisplayOnlyEnvironments(out);
  out = collapseDoubledBackslashCommands(out);
  out = stripDanglingBackslash(out);
  out = stripEquationNumbering(out);
  out = escapePercent(out);
  out = escapeStrayAmpersands(out);
  out = balanceEnvironments(out);
  out = balanceLeftRight(out);
  out = balanceBraces(out);
  return out;
}

/**
 * Walk a Markdown/plain string and repair the interior of every math span
 * (`$$…$$` first, then `$…$`), leaving all surrounding prose — including
 * currency like "$5" and literal "100%" outside math — untouched.
 *
 * Mirrors the delimiter scan remark-math performs, so what we repair is exactly
 * what KaTeX will later receive.
 */
export function repairMathSpans(input: string): string {
  if (!input || input.indexOf('$') === -1) return input;

  let out = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    // $$ … $$  (display)
    if (input[i] === '$' && input[i + 1] === '$') {
      const end = input.indexOf('$$', i + 2);
      if (end !== -1) {
        out += '$$' + repairMathTex(input.slice(i + 2, end)) + '$$';
        i = end + 2;
        continue;
      }
    }
    // $ … $  (inline) — the closing $ must be on the same line.
    if (input[i] === '$') {
      const rest = input.slice(i + 1);
      const newline = rest.indexOf('\n');
      const searchEnd = newline === -1 ? rest.length : newline;
      const rel = rest.slice(0, searchEnd).indexOf('$');
      if (rel !== -1) {
        const body = rest.slice(0, rel);
        out += '$' + repairMathTex(body) + '$';
        i = i + 1 + rel + 1;
        continue;
      }
    }
    out += input[i];
    i += 1;
  }

  return out;
}

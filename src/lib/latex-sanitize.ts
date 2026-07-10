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
function escapeStrayAmpersands(tex: string): string {
  const hasTabularEnv = [...tex.matchAll(/\\begin\s*\{([a-zA-Z]+\*?)\}/g)].some(
    ([, env]) => TABULAR_ENVIRONMENTS.has(env),
  );
  if (hasTabularEnv) return tex;
  return tex.replace(/(^|[^\\])&/g, '$1\\&');
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

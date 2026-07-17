/**
 * A tiny, safe math-expression compiler for the Grapher.
 *
 * No `eval` / `new Function` on user input — it tokenizes, converts to RPN via
 * the shunting-yard algorithm, and evaluates the RPN against a numeric scope.
 * Supports `+ - * / ^`, unary minus, implicit multiplication (`2x`, `(x+1)(x-1)`,
 * `a x`), the functions/constants listed below, and reports the free variables
 * (for parameter sliders) plus a human-readable parse error.
 */

type Fn = (...args: number[]) => number;

const FUNCTIONS: Record<string, { fn: Fn; arity: number }> = {
  sin: { fn: Math.sin, arity: 1 },
  cos: { fn: Math.cos, arity: 1 },
  tan: { fn: Math.tan, arity: 1 },
  asin: { fn: Math.asin, arity: 1 },
  acos: { fn: Math.acos, arity: 1 },
  atan: { fn: Math.atan, arity: 1 },
  sinh: { fn: Math.sinh, arity: 1 },
  cosh: { fn: Math.cosh, arity: 1 },
  tanh: { fn: Math.tanh, arity: 1 },
  sqrt: { fn: Math.sqrt, arity: 1 },
  cbrt: { fn: Math.cbrt, arity: 1 },
  abs: { fn: Math.abs, arity: 1 },
  exp: { fn: Math.exp, arity: 1 },
  ln: { fn: Math.log, arity: 1 },
  log: { fn: Math.log10, arity: 1 },
  log10: { fn: Math.log10, arity: 1 },
  log2: { fn: Math.log2, arity: 1 },
  floor: { fn: Math.floor, arity: 1 },
  ceil: { fn: Math.ceil, arity: 1 },
  round: { fn: Math.round, arity: 1 },
  sign: { fn: Math.sign, arity: 1 },
  min: { fn: Math.min, arity: 2 },
  max: { fn: Math.max, arity: 2 },
  pow: { fn: Math.pow, arity: 2 },
  atan2: { fn: Math.atan2, arity: 2 },
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const OPERATORS: Record<string, { precedence: number; rightAssociative: boolean }> = {
  '+': { precedence: 2, rightAssociative: false },
  '-': { precedence: 2, rightAssociative: false },
  '*': { precedence: 3, rightAssociative: false },
  '/': { precedence: 3, rightAssociative: false },
  // Unary minus sits between ^ and * so that -x^2 = -(x^2) and -x*y = (-x)*y.
  'u-': { precedence: 4, rightAssociative: true },
  '^': { precedence: 5, rightAssociative: true },
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.trim();

  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\t') {
      i += 1;
      continue;
    }
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i;
      while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j += 1;
      const raw = src.slice(i, j);
      const value = Number(raw);
      if (Number.isNaN(value)) throw new Error(`Invalid number "${raw}".`);
      tokens.push({ type: 'num', value });
      i = j;
      continue;
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      let j = i;
      while (j < src.length && ((src[j] >= 'a' && src[j] <= 'z') || (src[j] >= 'A' && src[j] <= 'Z') || (src[j] >= '0' && src[j] <= '9'))) j += 1;
      tokens.push({ type: 'id', value: src.slice(i, j).toLowerCase() });
      i = j;
      continue;
    }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i += 1; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i += 1; continue; }
    if (ch === ',') { tokens.push({ type: 'comma' }); i += 1; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    // Unicode niceties users may type.
    if (ch === '−') { tokens.push({ type: 'op', value: '-' }); i += 1; continue; }
    if (ch === '×' || ch === '·') { tokens.push({ type: 'op', value: '*' }); i += 1; continue; }
    if (ch === '÷') { tokens.push({ type: 'op', value: '/' }); i += 1; continue; }
    throw new Error(`Unexpected character "${ch}".`);
  }
  return tokens;
}

function isFunction(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(FUNCTIONS, id);
}

/** Insert explicit `*` tokens for implicit multiplication between operands. */
function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx += 1) {
    const prev = out[out.length - 1];
    const cur = tokens[idx];
    if (prev) {
      const prevEndsOperand =
        prev.type === 'num' ||
        prev.type === 'rparen' ||
        (prev.type === 'id' && !isFunction(prev.value));
      const curStartsOperand =
        cur.type === 'num' || cur.type === 'lparen' || cur.type === 'id';
      if (prevEndsOperand && curStartsOperand) {
        out.push({ type: 'op', value: '*' });
      }
    }
    out.push(cur);
  }
  return out;
}

type RpnItem =
  | { kind: 'num'; value: number }
  | { kind: 'const'; value: number }
  | { kind: 'var'; name: string }
  | { kind: 'op'; value: string }
  | { kind: 'func'; name: string };

function toRpn(tokens: Token[], variables: Set<string>): RpnItem[] {
  const output: RpnItem[] = [];
  const stack: Token[] = [];

  const popOperatorsWhile = (test: (op: string) => boolean): void => {
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.type === 'op' && test(top.value)) {
        output.push({ kind: 'op', value: (stack.pop() as { value: string }).value });
      } else {
        break;
      }
    }
  };

  let prev: Token | null = null;
  for (const token of tokens) {
    if (token.type === 'num') {
      output.push({ kind: 'num', value: token.value });
    } else if (token.type === 'id') {
      if (isFunction(token.value)) {
        stack.push(token);
      } else if (Object.prototype.hasOwnProperty.call(CONSTANTS, token.value)) {
        output.push({ kind: 'const', value: CONSTANTS[token.value] });
      } else {
        variables.add(token.value);
        output.push({ kind: 'var', name: token.value });
      }
    } else if (token.type === 'op') {
      // Detect unary minus/plus.
      const isUnary =
        !prev ||
        prev.type === 'op' ||
        prev.type === 'lparen' ||
        prev.type === 'comma';
      if (isUnary && token.value === '-') {
        stack.push({ type: 'op', value: 'u-' });
        prev = token;
        continue;
      }
      if (isUnary && token.value === '+') {
        prev = token; // unary plus is a no-op
        continue;
      }
      const o1 = OPERATORS[token.value];
      popOperatorsWhile((topValue) => {
        const o2 = OPERATORS[topValue];
        if (!o2) return false;
        return o2.precedence > o1.precedence || (o2.precedence === o1.precedence && !o1.rightAssociative);
      });
      stack.push(token);
    } else if (token.type === 'comma') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        output.push({ kind: 'op', value: (stack.pop() as { value: string }).value });
      }
      if (!stack.length) throw new Error('Misplaced comma or missing "(".');
    } else if (token.type === 'lparen') {
      stack.push(token);
    } else if (token.type === 'rparen') {
      while (stack.length && stack[stack.length - 1].type !== 'lparen') {
        output.push({ kind: 'op', value: (stack.pop() as { value: string }).value });
      }
      if (!stack.length) throw new Error('Mismatched ")".');
      stack.pop(); // discard '('
      const top = stack[stack.length - 1];
      if (top && top.type === 'id' && isFunction(top.value)) {
        output.push({ kind: 'func', name: (stack.pop() as { value: string }).value });
      }
    }
    prev = token;
  }

  while (stack.length) {
    const top = stack.pop() as Token;
    if (top.type === 'lparen' || top.type === 'rparen') throw new Error('Mismatched parentheses.');
    output.push({ kind: 'op', value: (top as { value: string }).value });
  }
  return output;
}

function applyOperator(op: string, stack: number[]): void {
  if (op === 'u-') {
    if (stack.length < 1) throw new Error('Malformed expression.');
    stack.push(-(stack.pop() as number));
    return;
  }
  if (stack.length < 2) throw new Error('Malformed expression.');
  const b = stack.pop() as number;
  const a = stack.pop() as number;
  switch (op) {
    case '+': stack.push(a + b); break;
    case '-': stack.push(a - b); break;
    case '*': stack.push(a * b); break;
    case '/': stack.push(a / b); break;
    case '^': stack.push(a ** b); break;
    default: throw new Error(`Unknown operator "${op}".`);
  }
}

export type CompiledExpression = {
  /** Evaluate for a given scope (must include every free variable). */
  evaluate: (scope: Record<string, number>) => number;
  /** Free variables (excludes x, constants and functions) — used for sliders. */
  variables: string[];
  /** True when the source parsed into a runnable expression. */
  ok: boolean;
  /** Human-readable parse error, or null. */
  error: string | null;
};

/**
 * Compile `source` (the right-hand side of `y = …`). `x` is treated as the plot
 * variable; any other bare identifier becomes a free variable (a slider param).
 */
export function compileExpression(source: string): CompiledExpression {
  const variables = new Set<string>();
  let rpn: RpnItem[];
  try {
    const trimmed = source.trim();
    if (!trimmed) throw new Error('Empty expression.');
    const tokens = insertImplicitMultiplication(tokenize(trimmed));
    rpn = toRpn(tokens, variables);
    if (!rpn.length) throw new Error('Empty expression.');
  } catch (error) {
    return {
      evaluate: () => NaN,
      variables: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid expression.',
    };
  }

  const freeVariables = Array.from(variables).filter((name) => name !== 'x');

  // May throw on a malformed RPN (e.g. operator underflow from "2 +* 3").
  const run = (scope: Record<string, number>): number => {
    const stack: number[] = [];
    for (const item of rpn) {
      switch (item.kind) {
        case 'num':
        case 'const':
          stack.push(item.value);
          break;
        case 'var': {
          const value = scope[item.name];
          stack.push(typeof value === 'number' ? value : NaN);
          break;
        }
        case 'op':
          applyOperator(item.value, stack);
          break;
        case 'func': {
          const def = FUNCTIONS[item.name];
          if (stack.length < def.arity) throw new Error('Malformed expression.');
          const args = def.arity === 1 ? [stack.pop() as number] : [stack.pop() as number, stack.pop() as number].reverse();
          stack.push(def.fn(...args));
          break;
        }
      }
    }
    if (stack.length !== 1) throw new Error('Malformed expression.');
    return stack[0];
  };

  // Compile-time validation: a trial run with every symbol = 1 surfaces
  // structural errors (operator underflow, leftover operands) up front.
  try {
    const trialScope: Record<string, number> = {};
    for (const name of variables) trialScope[name] = 1;
    run(trialScope);
  } catch (error) {
    return {
      evaluate: () => NaN,
      variables: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid expression.',
    };
  }

  // Runtime evaluate never throws — a bad point just yields NaN and is skipped.
  const evaluate = (scope: Record<string, number>): number => {
    try {
      return run(scope);
    } catch {
      return NaN;
    }
  };

  return { evaluate, variables: freeVariables, ok: true, error: null };
}

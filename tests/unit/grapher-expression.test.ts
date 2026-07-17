import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileExpression } from '../../src/lib/grapher/expression';

const at = (source: string, scope: Record<string, number> = {}): number =>
  compileExpression(source).evaluate(scope);

test('basic arithmetic and precedence', () => {
  assert.equal(at('1 + 2 * 3'), 7);
  assert.equal(at('(1 + 2) * 3'), 9);
  assert.equal(at('2 - 3 - 4'), -5); // left-assoc
  assert.equal(at('8 / 4 / 2'), 1); // left-assoc
});

test('exponent is right-associative and above multiplication', () => {
  assert.equal(at('2 ^ 3 ^ 2'), 512); // 2^(3^2)
  assert.equal(at('3 * 2 ^ 2'), 12);
});

test('unary minus binds below exponent', () => {
  assert.equal(at('-3 ^ 2'), -9); // -(3^2)
  assert.equal(at('-2 * 3'), -6);
  assert.equal(at('2 + -3'), -1);
});

test('functions and constants', () => {
  assert.ok(Math.abs(at('sin(pi / 2)') - 1) < 1e-12);
  assert.ok(Math.abs(at('cos(0)') - 1) < 1e-12);
  assert.equal(at('sqrt(16)'), 4);
  assert.equal(at('abs(-5)'), 5);
  assert.equal(at('max(3, 7)'), 7);
  assert.equal(at('pow(2, 10)'), 1024);
  assert.ok(Math.abs(at('ln(e)') - 1) < 1e-12);
  assert.equal(at('log(1000)'), 3); // base-10
});

test('implicit multiplication', () => {
  assert.equal(at('2x', { x: 5 }), 10);
  assert.equal(at('(x + 1)(x - 1)', { x: 3 }), 8); // 4 * 2
  assert.equal(at('2(3)'), 6);
  assert.equal(at('3sin(0)'), 0);
});

test('variables: x and free parameters', () => {
  const compiled = compileExpression('a * x + b');
  assert.deepEqual(compiled.variables.sort(), ['a', 'b']);
  assert.equal(compiled.evaluate({ x: 4, a: 2, b: 1 }), 9);
});

test('x is the plot variable, not a slider parameter', () => {
  const compiled = compileExpression('x ^ 2');
  assert.deepEqual(compiled.variables, []);
  assert.equal(compiled.evaluate({ x: 3 }), 9);
});

test('invalid expressions report an error and do not throw', () => {
  const bad = compileExpression('2 +* 3');
  assert.equal(bad.ok, false);
  assert.ok(bad.error);
  const unbalanced = compileExpression('(1 + 2');
  assert.equal(unbalanced.ok, false);
  const empty = compileExpression('   ');
  assert.equal(empty.ok, false);
});

test('division by zero and domain errors yield non-finite, not exceptions', () => {
  assert.equal(at('1 / 0'), Infinity);
  assert.ok(Number.isNaN(at('sqrt(-1)')));
  assert.ok(Number.isNaN(at('ln(-1)')));
});

---
title: "Polynomials: Important Points and Traps"
type: key_points
chapter: c10.mathematics.polynomials
order: 3
---

## Polynomials and zeroes

:::remember
- A zero of $p(x)$ is a real number $k$ with $p(k) = 0$.
- A linear polynomial has **exactly one** zero. A quadratic has **at most 2**. A cubic has **at most 3**.
- A polynomial of degree $n$ has **at most $n$** zeroes.
- The zeroes are the x-coordinates of the points where the graph of $y = p(x)$ meets the x-axis.
:::

:::trap
$\sqrt{x} + 2$ and $x + \dfrac1x$ are **not** polynomials. But $\sqrt2\,x + 1$ **is** one: a root in a coefficient is fine, a root on the variable is not.
:::

:::trap
In $ax^2 + bx + c$, always check $a \ne 0$. If $a = 0$, it is not a quadratic any more.
:::

## Reading a graph

- Count only the points on the **x-axis**. The point where the graph cuts the **y-axis** gives $p(0)$, the constant term. It is not a zero, unless it is the origin $(0, 0)$.
- A graph that **touches** the x-axis at one point and turns back gives **one** zero there. For a quadratic, this is the case of two equal zeroes.
- A parabola that stays fully above or fully below the x-axis gives **no** zero.
- Number of zeroes = number of points where the graph meets the x-axis. The number of bends does not matter.

:::tip
Opens upwards if $a > 0$, downwards if $a < 0$. Think: positive = smile, negative = frown.
:::

## Sum and product

:::trap
**The sign.** Sum $= -\dfrac{b}{a}$ has a **minus**. Product $= \dfrac{c}{a}$ has **no** minus. Students often drop the minus in the sum.
:::

:::trap
**Write the polynomial in standard form first.** In $6x^2 - 3 - 7x$, the order is mixed. Rewrite it as $6x^2 - 7x - 3$, so $a = 6$, $b = -7$, $c = -3$.
:::

- If a term is missing, its coefficient is 0. In $t^2 - 15$, $b = 0$, so the sum of zeroes is 0. In $4u^2 + 8u$, $c = 0$, so one zero is 0.
- Zeroes can be fractions or surds ($\sqrt3$, $-\sqrt3$). Keep them exact; do not use decimals.
- To **verify** the relationship, find the zeroes first, then work out the sum and product from them, and compare with $-\dfrac{b}{a}$ and $\dfrac{c}{a}$. Show both sides.

## Making a quadratic

:::trap
From sum $S$ and product $P$, the polynomial is $x^2 - Sx + P$. The sum goes in with a **minus** sign. For $S = -3$, the middle term is $+3x$, not $-3x$.
:::

- The answer is not unique. Any $k(x^2 - Sx + P)$ with $k \ne 0$ works. Choose $k$ to clear fractions.
- "Sum and product" questions give **sum first**, then product. Read the order.

## Cubic relations

:::remember
For $ax^3 + bx^2 + cx + d$:
- sum of zeroes $= -\dfrac{b}{a}$
- sum of products two at a time $= \dfrac{c}{a}$
- product of zeroes $= -\dfrac{d}{a}$

The signs go **minus, plus, minus**.
:::

:::trap
The product of the zeroes of a **cubic** is $-\dfrac{d}{a}$, but for a **quadratic** it is $+\dfrac{c}{a}$. Do not mix them up.
:::

## Useful tricks (beyond the Class 10 book)

These use only the sum and product, so you need not find the zeroes.

- $\alpha^2 + \beta^2 = (\alpha + \beta)^2 - 2\alpha\beta$
- $\dfrac1\alpha + \dfrac1\beta = \dfrac{\alpha + \beta}{\alpha\beta}$
- If one zero is $m$ times the other, write the zeroes as $\alpha$ and $m\alpha$.
- If $k$ is a zero, put $p(k) = 0$ to find an unknown coefficient.

:::tip
In a quadratic, if one zero is known, get the other one from the product: other zero $= \dfrac{c}{a} \div$ (known zero), when the known zero is not 0. Then check with the sum.
:::

## Removed topic

- The **division algorithm** section is not in the current (rationalised) NCERT book. Do not expect it in this chapter.

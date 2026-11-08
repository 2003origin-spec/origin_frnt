---
title: "Polynomials: Short Notes"
type: short_notes
chapter: c10.mathematics.polynomials
order: 2
---

## 1. Polynomials and degree (Class 9 recap)

- In a polynomial, every power of the variable is a **whole number** (0, 1, 2, ...).
- The **degree** is the highest power of the variable. $5x^3 - 4x^2 + x - \sqrt2$ has degree 3.
- These are **not** polynomials: $\dfrac{1}{x - 1}$, $\sqrt{x} + 2$, $\dfrac{1}{x^2 + 2x + 3}$. They have the variable under a root or in the denominator.

| Degree | Name | General form |
|---|---|---|
| 1 | Linear | $ax + b$ |
| 2 | Quadratic | $ax^2 + bx + c$ |
| 3 | Cubic | $ax^3 + bx^2 + cx + d$ |

In each form the coefficients are real numbers and $a \ne 0$. "Quadratic" comes from "quadrate", which means square.

## 2. Value and zero of a polynomial

- The **value** of $p(x)$ at $x = k$ is $p(k)$: put $k$ in place of $x$.
- A real number $k$ is a **zero** of $p(x)$ if $p(k) = 0$.

:::example{title="Finding zeroes by checking"}
$p(x) = x^2 - 3x - 4$.

$p(-1) = 1 + 3 - 4 = 0$ and $p(4) = 16 - 12 - 4 = 0$.

So $-1$ and $4$ are zeroes of $p(x)$.
:::

- The zero of $ax + b$ is $-\dfrac{b}{a}$. For $2x + 3$ it is $-\dfrac32$.

## 3. Zeroes on a graph

**Key idea:** the zeroes of $p(x)$ are the x-coordinates of the points where the graph of $y = p(x)$ meets the x-axis.

**Linear.** The graph of $y = ax + b$ is a straight line. It cuts the x-axis at exactly one point, $\left(-\dfrac{b}{a}, 0\right)$. So a linear polynomial has exactly one zero.

**Quadratic.** The graph of $y = ax^2 + bx + c$ is a curve called a **parabola**.
- If $a > 0$, it opens **upwards** (like a cup).
- If $a < 0$, it opens **downwards** (like a cap).

Three things can happen:

| Graph | Zeroes |
|---|---|
| Cuts the x-axis at two points | two different zeroes |
| Touches the x-axis at one point | two equal zeroes (one zero) |
| Does not meet the x-axis | no zero |

So a quadratic polynomial has **at most 2** zeroes.

**Cubic.** The graph of a cubic meets the x-axis at most 3 times. So a cubic has **at most 3** zeroes.

:::example{title="Three cubics from the book"}
- $x^3 - 4x = x(x - 2)(x + 2)$: zeroes $-2, 0, 2$.
- $x^3$: only zero is $0$.
- $x^3 - x^2 = x^2(x - 1)$: zeroes $0$ and $1$.
:::

**In general:** a polynomial of degree $n$ meets the x-axis at most $n$ times, so it has **at most $n$ zeroes**.

:::remember
NCERT says you do not have to plot graphs of quadratic or cubic polynomials, and this plotting is not tested. But you should be able to **read** the number of zeroes from a given graph, as in Exercise 2.1.
:::

## 4. Zeroes and coefficients of a quadratic

Factorise by splitting the middle term, then compare.

:::example{title="2x² − 8x + 6"}
$2x^2 - 8x + 6 = 2(x - 1)(x - 3)$, so the zeroes are 1 and 3.

Sum $= 1 + 3 = 4 = -\dfrac{(-8)}{2}$

Product $= 1 \times 3 = 3 = \dfrac{6}{2}$
:::

**Why it works.** If $\alpha, \beta$ are the zeroes, then $(x - \alpha)$ and $(x - \beta)$ are factors. So
$$ax^2 + bx + c = a(x - \alpha)(x - \beta)$$
$$= ax^2 - a(\alpha + \beta)x + a\alpha\beta$$
Compare the coefficients of $x$ and the constant terms:
$$\alpha + \beta = -\frac{b}{a}$$
$$\alpha\beta = \frac{c}{a}$$

:::example{title="x² − 3 (zeroes are not whole numbers)"}
$x^2 - 3 = (x - \sqrt3)(x + \sqrt3)$, so the zeroes are $\sqrt3$ and $-\sqrt3$.

Sum $= 0 = -\dfrac{0}{1}$ (there is no $x$ term, so $b = 0$).

Product $= -3 = \dfrac{-3}{1}$.
:::

## 5. Making a quadratic from its zeroes

- If you know the zeroes $\alpha, \beta$: $p(x) = k(x - \alpha)(x - \beta)$.
- If you know only the sum $S$ and the product $P$: $p(x) = k\left[x^2 - Sx + P\right]$.
- $k$ can be any non-zero real number. So there are **many** answers. Write "a quadratic polynomial is ...".

:::example{title="Sum −3, product 2"}
$x^2 - (-3)x + 2 = x^2 + 3x + 2$.

Every other answer is $k(x^2 + 3x + 2)$, with $k$ real and non-zero.
:::

:::example{title="Clearing fractions"}
Sum $= \dfrac14$, product $= -1$: $x^2 - \dfrac14 x - 1$.

Take $k = 4$: $4x^2 - x - 4$.
:::

## 6. Zeroes and coefficients of a cubic

If $\alpha, \beta, \gamma$ are the zeroes of $ax^3 + bx^2 + cx + d$:

- $\alpha + \beta + \gamma = -\dfrac{b}{a}$
- $\alpha\beta + \beta\gamma + \gamma\alpha = \dfrac{c}{a}$
- $\alpha\beta\gamma = -\dfrac{d}{a}$

:::example{title="2x³ − 5x² − 14x + 8"}
The zeroes are $4, -2, \dfrac12$ ($a = 2$, $b = -5$, $c = -14$, $d = 8$).
- Sum: $4 - 2 + \dfrac12 = \dfrac52 = -\dfrac{(-5)}{2}$
- Two at a time: $-8 - 1 + 2 = -7 = \dfrac{-14}{2}$
- Product: $4 \times (-2) \times \dfrac12 = -4 = -\dfrac{8}{2}$
:::

:::remember
The cubic relations are in the chapter and its summary. NCERT marks the worked cubic example (Example 5) "not from the examination point of view", and the exercises ask only about quadratics.
:::

## 7. What is not in this chapter now

The **division algorithm** for polynomials was removed when NCERT rationalised the book. The introduction still has one line saying "we will also study the division algorithm", but that section is no longer in the book.

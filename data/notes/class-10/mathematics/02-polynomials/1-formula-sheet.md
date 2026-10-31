---
title: "Polynomials: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.polynomials
order: 1
---

## General forms

The **degree** is the highest power of $x$. In every form below, $a, b, c, d$ are real numbers and $a \ne 0$.

:::formula{title="Linear polynomial (degree 1)"}
$$p(x) = ax + b$$
Example: $2x - 3$.
:::

:::formula{title="Quadratic polynomial (degree 2)"}
$$p(x) = ax^2 + bx + c$$
Example: $x^2 - 3x - 4$.
:::

:::formula{title="Cubic polynomial (degree 3)"}
$$p(x) = ax^3 + bx^2 + cx + d$$
Example: $x^3 - 4x$.
:::

## Value and zero

:::formula{title="Value at x = k"}
$p(k)$ = the number you get when you put $x = k$ in $p(x)$.

For $p(x) = x^2 - 3x - 4$:
$$p(2) = 4 - 6 - 4 = -6$$
:::

:::formula{title="Zero of a polynomial"}
A real number $k$ is a **zero** of $p(x)$ when
$$p(k) = 0$$
For $x^2 - 3x - 4$, the zeroes are $-1$ and $4$.
:::

:::formula{title="Zero of a linear polynomial"}
Solve $ax + b = 0$:
$$x = -\frac{b}{a}$$
That is, zero $= -\dfrac{\text{constant term}}{\text{coefficient of } x}$. A linear polynomial has **exactly one** zero.
:::

## Zeroes on a graph

:::formula{title="Meaning of a zero on the graph"}
Zeroes of $p(x)$ = the **x-coordinates** of the points where the graph of $y = p(x)$ meets the x-axis.

- Graph of $y = ax + b$: a straight line. It meets the x-axis at $\left(-\dfrac{b}{a},\ 0\right)$.
- Graph of $y = ax^2 + bx + c$: a parabola. It opens **upwards** if $a > 0$ and **downwards** if $a < 0$.
:::

How many zeroes a polynomial can have:

| Degree | Name | Zeroes |
|---|---|---|
| 1 | Linear | exactly 1 |
| 2 | Quadratic | 0, 1 or 2 |
| 3 | Cubic | at most 3 |
| $n$ | — | at most $n$ |

## Zeroes and coefficients: quadratic

$\alpha$ and $\beta$ are the zeroes of $ax^2 + bx + c$, $a \ne 0$.

:::formula{title="Sum of zeroes"}
$$\alpha + \beta = -\frac{b}{a}$$
In words: $-\dfrac{\text{coefficient of } x}{\text{coefficient of } x^2}$
:::

:::formula{title="Product of zeroes"}
$$\alpha\beta = \frac{c}{a}$$
In words: $\dfrac{\text{constant term}}{\text{coefficient of } x^2}$
:::

:::formula{title="Quadratic from its zeroes"}
If the zeroes are $\alpha$ and $\beta$:
$$p(x) = k(x - \alpha)(x - \beta)$$
$k$ is any non-zero real number.
:::

:::formula{title="Quadratic from sum and product"}
If sum of zeroes $= S$ and product $= P$:
$$p(x) = k\left[x^2 - Sx + P\right]$$
$k$ is any non-zero real number. Take $k = 1$, or choose $k$ to clear fractions.
:::

## Zeroes and coefficients: cubic

$\alpha, \beta, \gamma$ are the zeroes of $ax^3 + bx^2 + cx + d$, $a \ne 0$.

:::formula{title="Sum of zeroes"}
$$\alpha + \beta + \gamma = -\frac{b}{a}$$
:::

:::formula{title="Sum of products, two at a time"}
$$\alpha\beta + \beta\gamma + \gamma\alpha = \frac{c}{a}$$
:::

:::formula{title="Product of zeroes"}
$$\alpha\beta\gamma = -\frac{d}{a}$$
:::

## Useful results (beyond the Class 10 book)

These are not printed in the book. They come from the sum and product above and Class 9 identities. Board papers often use them.

:::formula{title="Expressions in α and β"}
$$\alpha^2 + \beta^2 = (\alpha + \beta)^2 - 2\alpha\beta$$
$$(\alpha - \beta)^2 = (\alpha + \beta)^2 - 4\alpha\beta$$
$$\frac1\alpha + \frac1\beta = \frac{\alpha+\beta}{\alpha\beta}$$
The last one needs $\alpha\beta \ne 0$, that is $c \ne 0$.
:::

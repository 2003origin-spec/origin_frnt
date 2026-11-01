---
title: "Sequences and Series: Important Points and Traps"
type: key_points
chapter: c11.mathematics.sequences-and-series
order: 3
---

## Spotting an AP or a GP

:::remember
- **AP** if and only if $a_n$ is linear in $n$ ($a_n = pn + q$). Then $d = p$.
- **AP** if and only if $S_n = Pn^2 + Qn$, with **no constant term**. Then $d = 2P$.
- **GP** if and only if $a_n = k\,r^n$ for fixed $k$ and $r$, both non-zero.
- $a, b, c$ in AP: $2b = a + c$. In GP (non-zero terms): $b^2 = ac$. In HP (exam extra): $b = \dfrac{2ac}{a + c}$.
:::

:::trap
$a_n = S_n - S_{n-1}$ only works for $n \ge 2$. Always find $a_1 = S_1$ separately. If the formula for $S_n$ does not give 0 at $n = 0$ (for a polynomial: if it has a constant term), the first term breaks the pattern.

Example: $S_n = n^2 + 1$ gives $a_1 = 2$, but $a_n = 2n - 1$ for $n \ge 2$ (that is 3, 5, 7, ...). It is **not** an AP from the start.

Same idea for a GP: $S_n = 3^n + k$ is a GP from the first term only when $k = -1$.
:::

## Arithmetic progressions

- Number of terms from $a$ to $l$: $n = \dfrac{l - a}{d} + 1$. Forgetting the "+1" is the most common slip.
- When $n$ is odd, $S_n = n \times$ (the middle term).
- The sum of any two terms equally far from the two ends is $a + l$.

:::trap
$n$ must be a **positive whole number**. Reject fractions and negatives.

Two positive answers can **both** be right when the terms change sign ($a$ and $d$ of opposite signs). For 20, 18, 16, ..., the sum is 108 for both $n = 9$ and $n = 12$, because the 10th, 11th and 12th terms (2, 0, −2) add up to zero.
:::

## Geometric progressions

:::trap
$S_\infty = \dfrac{a}{1 - r}$ only when $|r| < 1$. For $|r| \ge 1$ the infinite sum doesn't exist. Check $r$ before using the formula.
:::

- $r$ can be negative ($2, -6, 18, \dots$), but no term can be 0.
- The product of two terms equally far from the two ends is always $a \times l$.
- If $a, b, c$ are in GP, then $\log a, \log b, \log c$ are in AP (for positive terms).

:::trap
When solving $r^2 = 4$, keep **both** $r = 2$ and $r = -2$ unless the question says the terms are positive. Each gives a different GP.
:::

## Means

:::trap
**AM ≥ GM needs positive numbers.** For $x < 0$, $x + \dfrac1x$ is at most $-2$, not at least 2.
:::

:::trap
**The bound only counts if equality can happen.** AM = GM only when the numbers are equal, so check that they can be equal for the allowed values. For $x \ge 2$, $x + \dfrac1x \ge 2$ is true but never reached: the least value is $2.5$, at $x = 2$.
:::

- (Exam extra) For two positive numbers, $A \ge G \ge H$ and $G^2 = AH$: the GM is the GM of the AM and the HM.

:::tip
To minimise a sum of positive terms, make the product of its terms constant, apply AM ≥ GM, then check that the terms can be equal.

To maximise a product, make the sum constant. Among rectangles with a fixed perimeter, the square has the largest area.
:::

## Writing terms smartly

:::tip
- 3 terms in AP: $a - d,\ a,\ a + d$.
- 4 terms in AP: $a - 3d,\ a - d,\ a + d,\ a + 3d$ (common difference $2d$).
- 3 terms in GP: $\dfrac{a}{r},\ a,\ ar$.
- 4 terms in GP: $\dfrac{a}{r^3},\ \dfrac{a}{r},\ ar,\ ar^3$. The common ratio is $r^2$, so this only fits a **positive** ratio; otherwise use $a,\ ar,\ ar^2,\ ar^3$.

The sum (for an AP) or the product (for a GP) then gives $a$ quickly. For 4 GP terms the product is $a^4$, so check both signs of $a$.
:::

## Recurring decimals and repeated digits

- A recurring decimal is the sum of an infinite GP (plus a terminating part if some digits don't repeat): $0.\overline{36} = \dfrac{36}{100} + \dfrac{36}{100^2} + \cdots = \dfrac{36}{99} = \dfrac{4}{11}$.
- For $7 + 77 + 777 + \cdots$, write $777 = \dfrac79 \times 999 = \dfrac79(10^3 - 1)$. Each term becomes a GP term minus a constant.

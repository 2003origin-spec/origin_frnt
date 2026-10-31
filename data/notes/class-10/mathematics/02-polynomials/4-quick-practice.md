---
title: "Polynomials: Quick Practice"
type: practice
chapter: c10.mathematics.polynomials
order: 4
---

Try each question first, then tap **Show answer**.

## Zeroes and graphs

:::question{title="1. Which are zeroes?" exam="Board level"}
For $p(x) = x^2 - 3x - 10$, which of $2$, $-2$ and $5$ are zeroes of $p(x)$?

---

$p(2) = 4 - 6 - 10 = -12$, $p(-2) = 4 + 6 - 10 = 0$, $p(5) = 25 - 15 - 10 = 0$.

The zeroes are **$-2$ and $5$**.
:::

:::question{title="2. Reading a graph" exam="Board level"}
The graph of $y = p(x)$ cuts the x-axis at $(-4, 0)$ and $(2, 0)$, touches it at $(5, 0)$, and cuts the y-axis at $(0, 6)$. How many zeroes does $p(x)$ have?

---

Count only the points on the x-axis: $x = -4$, $2$ and $5$. The point $(0, 6)$ is on the y-axis, so it is not a zero.

**3 zeroes: $-4$, $2$ and $5$.**
:::

:::question{title="3. No zero" exam="Board level"}
Show that $x^2 + 2x + 5$ has no zero.

---

$x^2 + 2x + 5 = (x + 1)^2 + 4$. A square is never negative, so the value is always at least 4.

It is never 0, so the parabola stays above the x-axis. **It has no zero.**
:::

## Zeroes and coefficients

:::question{title="4. Find and verify" exam="Board level"}
Find the zeroes of $6x^2 - x - 2$ and verify the relationship between the zeroes and the coefficients.

---

Split $-x$ into $-4x + 3x$ (product $-12x^2$): $6x^2 - 4x + 3x - 2 = (3x - 2)(2x + 1)$. Zeroes: $\dfrac23$ and $-\dfrac12$.

Sum $= \dfrac23 - \dfrac12 = \dfrac16 = -\dfrac{(-1)}{6}$. Product $= -\dfrac13 = \dfrac{-2}{6}$.

**Zeroes $\dfrac23, -\dfrac12$; both relations hold.**
:::

:::question{title="5. Without finding the zeroes" exam="Board level"}
If $\alpha$ and $\beta$ are the zeroes of $2x^2 - 5x - 3$, find $\dfrac1\alpha + \dfrac1\beta$.

---

$\alpha + \beta = \dfrac52$ and $\alpha\beta = -\dfrac32$.

$\dfrac1\alpha + \dfrac1\beta = \dfrac{\alpha + \beta}{\alpha\beta} = \dfrac52 \div \left(-\dfrac32\right) =$ **$-\dfrac53$**.

(Check: the zeroes are 3 and $-\frac12$, and $\frac13 - 2 = -\frac53$.)
:::

## Making a quadratic

:::question{title="6. From sum and product" exam="Board level"}
Find a quadratic polynomial whose sum of zeroes is $\sqrt3$ and product of zeroes is $\dfrac12$.

---

$x^2 - \sqrt3\,x + \dfrac12$. Multiply by 2 to clear the fraction:

**$2x^2 - 2\sqrt3\,x + 1$** (or any non-zero multiple of it).
:::

:::question{title="7. From the zeroes" exam="Board level"}
Find a quadratic polynomial whose zeroes are $2$ and $-\dfrac13$.

---

Sum $= 2 - \dfrac13 = \dfrac53$. Product $= -\dfrac23$.

$x^2 - \dfrac53 x - \dfrac23$. Multiply by 3: **$3x^2 - 5x - 2$**.
:::

## Finding a missing value

:::question{title="8. One zero given" exam="Board level"}
If $3$ is a zero of $x^2 + kx - 15$, find $k$ and the other zero.

---

$p(3) = 9 + 3k - 15 = 0$, so $k = 2$.

Product of zeroes $= -15$, so the other zero is $-15 \div 3 = -5$. Check the sum: $3 + (-5) = -2 = -k$.

**$k = 2$; the other zero is $-5$.**
:::

:::question{title="9. One zero twice the other" exam="Board level"}
One zero of $x^2 - 6x + k$ is twice the other. Find $k$.

---

Let the zeroes be $\alpha$ and $2\alpha$. Sum: $3\alpha = 6$, so $\alpha = 2$ and the zeroes are 2 and 4.

Product: $k = 2 \times 4 =$ **8**.
:::

## Cubic

:::question{title="10. The third zero" exam="Board level"}
Two zeroes of $2x^3 + x^2 - 13x + 6$ are $2$ and $-3$. Find the third zero.

---

Sum of zeroes $= -\dfrac{b}{a} = -\dfrac12$. So $2 + (-3) + \gamma = -\dfrac12$, which gives $\gamma = \dfrac12$.

Check with the product: $2 \times (-3) \times \dfrac12 = -3 = -\dfrac{6}{2}$.

The third zero is **$\dfrac12$**.
:::

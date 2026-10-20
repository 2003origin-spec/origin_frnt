---
title: "Application of Integrals: Important Points and Traps"
type: key_points
chapter: c12.mathematics.application-of-integrals
order: 3
---

## Area is always positive

:::remember
- Area bounded by $y = f(x)$, the x-axis, $x = a$ and $x = b$: $\displaystyle\int_a^b f(x)\,dx$, when the curve is above the axis.
- Area bounded by $x = g(y)$, the y-axis, $y = c$ and $y = d$: $\displaystyle\int_c^d g(y)\,dy$, when the curve is right of the axis.
- If the area comes out negative, take its absolute value. Only the size counts.
:::

:::trap
**A definite integral is not always the area.** Parts below the axis count as negative, so they cancel parts above it.

$\displaystyle\int_{-1}^{1} x^3\,dx = 0$, but the area is $\dfrac14 + \dfrac14 = \dfrac12$.

$\displaystyle\int_0^{2\pi} \sin x\,dx = 0$, but the area is $4$.
:::

:::trap
**Split at every zero inside the interval.** First solve $f(x) = 0$. If a root lies strictly between $a$ and $b$, integrate on each side separately and add the absolute values. Using $|f(x)|$ without splitting does not save work: you still need the roots to remove the modulus.
:::

## Choosing the strip

- Vertical strips: limits are **$x$-values**, and the curve must be written as $y = f(x)$.
- Horizontal strips: limits are **$y$-values**, and the curve must be written as $x = g(y)$.

:::trap
Mixing them up is a common slip. For "the curve $y^2 = 4x$, the **y-axis** and the line $y = 3$", the region touches the y-axis, so use $x = \dfrac{y^2}{4}$ and integrate from $y = 0$ to $y = 3$. Integrating $2\sqrt{x}$ in $x$ from 0 to 3 finds a different region.
:::

:::tip
Choose the strip whose ends lie on the **same two curves** all the way across. Then one integral is enough. If either boundary (top or bottom, right or left) changes part way, switch to the other kind of strip, or split.
:::

## Square roots and symmetry

:::trap
$x^2 + y^2 = a^2$ gives $y = \pm\sqrt{a^2 - x^2}$. In the first quadrant take the **positive** root. Using the negative root gives a negative "area".
:::

:::trap
Multiply by 4 only if the region is symmetric about **both** axes (full circle, full ellipse, $|x| + |y| \le a$). A region symmetric about one axis only gets a factor of 2. A region in one quadrant gets no factor.
:::

- Odd functions such as $x^3$, $\sin x$, $x|x|$ on $[-a, a]$: the integral is 0, but the area is $2\displaystyle\int_0^a |f(x)|\,dx$.
- Even functions such as $x^2$, $\cos x$, $|x|$ on $[-a, a]$: the two halves are mirror images, so the area is also $2\displaystyle\int_0^a |f(x)|\,dx$.

## Standard answers to remember

:::remember
- Circle $x^2 + y^2 = a^2$: $\pi a^2$. Quarter circle: $\dfrac{\pi a^2}{4}$.
- Ellipse $\dfrac{x^2}{a^2} + \dfrac{y^2}{b^2} = 1$: $\pi a b$.
- One arch of $\sin x$ or $\cos x$: area 2.
- $\sin^{-1} 1 = \dfrac{\pi}{2}$ and $\sin^{-1} 0 = 0$. These finish most circle and ellipse integrals.
:::

:::trap
For $25x^2 + 4y^2 = 100$, first divide by 100: $\dfrac{x^2}{4} + \dfrac{y^2}{25} = 1$. So $a = 2$, $b = 5$ and the area is $\pi \cdot 2 \cdot 5 = 10\pi$. Do not use $a^2 = 4$ and $b^2 = 25$ in place of $a$ and $b$: that gives the wrong $100\pi$.
:::

## Area between two curves (exam extra)

:::trap
**Top minus bottom, not bigger formula minus smaller formula.** Check which curve is on top by testing one $x$ between the meeting points. If the answer comes out negative, you subtracted the wrong way round.
:::

:::trap
**Find every meeting point.** $y = x^3$ and $y = x$ meet at $x = -1, 0, 1$. The curves swap at $x = 0$, so the area is $2\displaystyle\int_0^1 (x - x^3)\,dx = \dfrac12$, not $\displaystyle\int_{-1}^{1} (x - x^3)\,dx = 0$.
:::

- When both curves are below the x-axis, top minus bottom still works. No absolute value is needed.
- For horizontal strips, it is **right minus left**, with $y$-limits.

:::tip
Ready results (exam extra shortcuts, not in NCERT; use them to check answers, all with $a, b, m > 0$):
- $y^2 = 4ax$ and $y = mx$: $\dfrac{8a^2}{3m^3}$.
- $y^2 = 4ax$ and $x = a$ (latus rectum): $\dfrac{8a^2}{3}$.
- $y^2 = 4ax$ and $x^2 = 4by$: $\dfrac{16ab}{3}$.
- A parabola cut by a chord at right angles to its axis (like the latus rectum) encloses $\dfrac23$ of the rectangle drawn around that piece.
:::

## Quick self-check

:::tip
Before writing the final answer: is it positive? Is it smaller than a simple rectangle that contains the region? A quarter circle of radius 2 must be less than $2 \times 2 = 4$, and $\pi \approx 3.14$ is.
:::

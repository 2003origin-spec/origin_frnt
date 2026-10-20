---
title: "Quadratic Equations: Important Points and Traps"
type: key_points
chapter: c10.mathematics.quadratic-equations
order: 3
---

## Is it quadratic?

:::remember
- $ax^2 + bx + c = 0$ is quadratic only when $a \ne 0$. $b$ or $c$ (or both) may be 0: $x^2 = 9$ and $x^2 - 4x = 0$ are quadratic.
- The roots of $ax^2 + bx + c = 0$ are the zeroes of the polynomial $ax^2 + bx + c$.
- A quadratic equation has **at most two** roots.
:::

:::trap
Always simplify before deciding. In $x(x + 1) + 8 = (x + 2)(x - 2)$, the $x^2$ terms cancel and you get $x + 12 = 0$: **not** quadratic. In $(x + 2)^3 = x^3 - 4$, the $x^3$ terms cancel and you get $x^2 + 2x + 2 = 0$: **quadratic**.
:::

## Factorisation

:::trap
**Never divide both sides by $x$.** From $x^2 = 5x$, dividing by $x$ gives only $x = 5$ and loses the root $x = 0$. Instead write $x(x - 5) = 0$, so $x = 0$ or $x = 5$.
:::

:::trap
Equate factors to zero only when the right side is **0**. $(x - 2)(x - 3) = 2$ does **not** mean $x - 2 = 2$ or $x - 3 = 2$. Expand first: $x^2 - 5x + 4 = 0$, so $x = 1$ or $x = 4$.
:::

:::tip
To split the middle term, look for two numbers with:
- **product** $= a \times c$,
- **sum** $= b$.

If $ac > 0$, both numbers have the same sign as $b$. If $ac < 0$, they have opposite signs, and the bigger one (in size) has the sign of $b$.
:::

## Quadratic formula

:::trap
Take $a$, $b$, $c$ **with their signs**, and only after writing the equation in standard form. In $5 - 2x^2 = 3x$, the standard form is $-2x^2 - 3x + 5 = 0$, so $a = -2$, $b = -3$, $c = 5$.
:::

:::trap
The formula has $-b$ on top. If $b = -6$, then $-b = +6$. And $(-6)^2 = 36$, not $-36$: $b^2$ is never negative.
:::

:::trap
The whole top, $-b \pm \sqrt{D}$, is divided by $2a$, not just the square root. So $\dfrac{4 \pm 2\sqrt3}{2} = 2 \pm \sqrt3$.
:::

- Find $D$ **before** using the formula. If $D < 0$, stop: there are no real roots.
- Simplify surds in the answer: $\sqrt{20} = 2\sqrt5$, $\sqrt{48} = 4\sqrt3$.

## Discriminant

:::remember
- $D = b^2 - 4ac$.
- $D > 0$: two distinct real roots.
- $D = 0$: two equal real roots, each $-\dfrac{b}{2a}$.
- $D < 0$: no real roots.
:::

:::trap
"**Real roots**" means $D \ge 0$ (equal roots are real too). "**Two distinct real roots**" means $D > 0$. "**Equal roots**" means $D = 0$. Read the question carefully.
:::

:::trap
When $k$ is in the $x^2$ term, check $a \ne 0$. For $kx^2 - 2kx + 1 = 0$ with equal roots, $D = 4k^2 - 4k = 0$ gives $k = 0$ or $k = 1$. But $k = 0$ makes the equation $1 = 0$, which is not quadratic. So $k = 1$ only.
:::

## Word problems

:::trap
**Check every root against the situation.** Lengths, speeds, prices and ages must be positive. A number of people or objects must be a whole number. Reject the other root, and say why.
:::

- In speed problems, time $= \dfrac{\text{distance}}{\text{speed}}$. The equation has fractions. Multiply both sides by the product of the denominators to clear them. Remember that $x$ (and $x + 5$ and so on) cannot be 0 there.
- Two consecutive integers are $x$ and $x + 1$. Two consecutive **odd** or **even** numbers are $x$ and $x + 2$.
- "Is it possible?" questions: work out $D$. If $D < 0$, the answer is "No". If $D \ge 0$, also check that the roots fit the situation.

:::tip
A quick check of your two roots: their sum should be $-\dfrac{b}{a}$ and their product $\dfrac{c}{a}$ (Chapter 2). For $x^2 - 7x + 12 = 0$, the roots 3 and 4 have sum 7 and product 12.
:::

## Good to know

- The current book gives the quadratic formula directly. The method of **completing the square** (used to prove it) is no longer taught in the Class 10 book.
- Brahmagupta (C.E. 598–665) gave a formula for $ax^2 + bx = c$. Sridharacharya (C.E. 1025) derived the formula now called the quadratic formula.

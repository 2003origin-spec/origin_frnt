---
title: "Complex Numbers: Quick Practice"
type: practice
chapter: c11.mathematics.complex-numbers-and-quadratic-equations
order: 4
---

Try each question first, then tap **Show answer**. Questions 7 to 10 use exam-extra topics (not in the current NCERT text).

## Algebra of complex numbers

:::question{title="1. Powers of i" exam="JEE Main level"}
Find $i^{57} + i^{70} + i^{-41}$.

---

$57 = 56 + 1$, so $i^{57} = i$. $70 = 68 + 2$, so $i^{70} = -1$. $-41 = -44 + 3$, so $i^{-41} = i^3 = -i$.

Sum $= i - 1 - i =$ **$-1$**.
:::

:::question{title="2. Square roots" exam="JEE Main level"}
Find $\sqrt{-16}\,\sqrt{-25} + \sqrt{-9}\,\sqrt{4}$.

---

$\sqrt{-16}\,\sqrt{-25} = (4i)(5i) = 20i^2 = -20$. (Not $\sqrt{400} = 20$: both numbers are negative.)

$\sqrt{-9}\,\sqrt4 = 3i \times 2 = 6i$.

Answer: **$-20 + 6i$**.
:::

:::question{title="3. Division" exam="JEE Main level"}
Write $\dfrac{3 + 4i}{1 - 2i}$ in the form $a + ib$.

---

Multiply top and bottom by $1 + 2i$:

$\dfrac{(3 + 4i)(1 + 2i)}{1 + 4} = \dfrac{3 + 6i + 4i - 8}{5} = \dfrac{-5 + 10i}{5} =$ **$-1 + 2i$**.
:::

:::question{title="4. Equating parts" exam="JEE Main level"}
Find real $x$ and $y$ if $(x + iy)(2 - 3i) = 4 + i$.

---

Left side $= (2x + 3y) + i(2y - 3x)$. So $2x + 3y = 4$ and $-3x + 2y = 1$.

Solving: **$x = \dfrac{5}{13}$, $y = \dfrac{14}{13}$**.
:::

## Modulus and conjugate

:::question{title="5. Modulus without expanding" exam="JEE Main level"}
Find $\left|\dfrac{(1 + i)^4\,(3 - 4i)}{(2 + i)^2}\right|$.

---

$|1 + i|^4 = (\sqrt2)^4 = 4$, $|3 - 4i| = 5$ and $|2 + i|^2 = 5$.

Modulus $= \dfrac{4 \times 5}{5} =$ **4**.
:::

:::question{title="6. Conjugate equals square" exam="JEE Main level"}
How many complex numbers $z$ satisfy $\bar z = z^2$?

---

Let $z = x + iy$. Then $x - iy = (x^2 - y^2) + 2ixy$, so $x = x^2 - y^2$ and $-y = 2xy$.

If $y = 0$: $x = x^2$, so $x = 0$ or $1$. That gives $z = 0, 1$.

If $y \ne 0$: $x = -\dfrac12$, then $y^2 = \dfrac14 + \dfrac12 = \dfrac34$, so $y = \pm\dfrac{\sqrt3}{2}$.

Total: **4** values: $0$, $1$ and $-\dfrac12 \pm \dfrac{\sqrt3}{2}i$ (that is, $\omega$ and $\omega^2$).
:::

## Argand plane and argument

:::question{title="7. Locus" exam="JEE Main level"}
Describe the set of points $z$ with $|z - 2| = |z + 2i|$.

---

$z$ is equally far from the points $(2, 0)$ and $(0, -2)$. With $z = x + iy$:

$(x - 2)^2 + y^2 = x^2 + (y + 2)^2$ gives $-4x = 4y$.

So it is the **straight line $x + y = 0$** (the perpendicular bisector of the two points).
:::

:::question{title="8. Principal argument" exam="JEE Main level"}
Find the modulus and the principal argument of $-1 - i\sqrt3$.

---

$r = \sqrt{1 + 3} = 2$. The point $(-1, -\sqrt3)$ is in quadrant III, and the acute angle is $\tan^{-1}\sqrt3 = \dfrac{\pi}{3}$.

$\arg z = -\left(\pi - \dfrac{\pi}{3}\right)$. So **$r = 2$, $\arg z = -\dfrac{2\pi}{3}$**.
:::

## Quadratic equations

:::question{title="9. Solving with D < 0" exam="JEE Main level"}
Solve $3x^2 - 2x + 1 = 0$.

---

$D = 4 - 12 = -8$, so $\sqrt{D} = 2\sqrt2\,i$.

$x = \dfrac{2 \pm 2\sqrt2\,i}{6} =$ **$\dfrac{1 \pm \sqrt2\,i}{3}$**.
:::

:::question{title="10. Coefficients from a root" exam="JEE Main level"}
One root of $x^2 + px + q = 0$, with $p, q$ real, is $2 - 3i$. Find $p$ and $q$.

---

Real coefficients, so the other root is $2 + 3i$.

Sum $= 4 = -p$. Product $= 4 + 9 = 13 = q$.

So **$p = -4$, $q = 13$**.
:::

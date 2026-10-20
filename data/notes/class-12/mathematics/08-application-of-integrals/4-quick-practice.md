---
title: "Application of Integrals: Quick Practice"
type: practice
chapter: c12.mathematics.application-of-integrals
order: 4
---

Try each question first, then tap **Show answer**. Questions 7 to 10 use area between two curves (exam extra: in the JEE Main syllabus, not in the current NCERT chapter).

## Area under a curve

:::question{title="1. Under a parabola" exam="JEE Main level"}
Find the area bounded by $y = x^2 + 1$, the x-axis and the lines $x = 0$ and $x = 3$.

---

The curve is above the x-axis, so
$A = \displaystyle\int_0^3 (x^2 + 1)\,dx = \left[\frac{x^3}{3} + x\right]_0^3 = 9 + 3 =$ **12**.
:::

:::question{title="2. Two arches" exam="JEE Main level"}
Find the area bounded by $y = \sin 2x$ and the x-axis from $x = 0$ to $x = \pi$.

---

$\sin 2x \ge 0$ on $\left[0, \frac{\pi}{2}\right]$ and $\le 0$ on $\left[\frac{\pi}{2}, \pi\right]$.

$\displaystyle\int_0^{\pi/2} \sin 2x\,dx = \left[-\frac{\cos 2x}{2}\right]_0^{\pi/2} = 1$. The second arch is the same size, below the axis.

Area $= 1 + 1 =$ **2**. (The plain integral from 0 to $\pi$ is 0.)
:::

:::question{title="3. Crossing the axis" exam="JEE Main level"}
Find the area bounded by $y = x^2 - 4x + 3$, the x-axis and the lines $x = 0$ and $x = 3$.

---

$x^2 - 4x + 3 = (x - 1)(x - 3)$: positive on $(0, 1)$, negative on $(1, 3)$. Let $F(x) = \dfrac{x^3}{3} - 2x^2 + 3x$.

$\displaystyle\int_0^1 = F(1) - F(0) = \frac43$ and $\displaystyle\int_1^3 = F(3) - F(1) = 0 - \frac43 = -\frac43$.

Area $= \dfrac43 + \dfrac43 =$ **$\dfrac83$**. (The plain integral from 0 to 3 is 0.)
:::

:::question{title="4. Horizontal strips" exam="JEE Main level"}
Find the area bounded by $y = \ln x$, the y-axis and the lines $y = 0$ and $y = 1$.

---

Write the curve as $x = e^y$. The region lies between the y-axis and this curve, for $y$ from 0 to 1.

$A = \displaystyle\int_0^1 e^y\,dy = \left[e^y\right]_0^1 =$ **$e - 1$** $\approx 1.72$.
:::

## Circle and ellipse

:::question{title="5. Ellipse" exam="JEE Main level"}
Find the area enclosed by the ellipse $9x^2 + 25y^2 = 225$.

---

Divide by 225: $\dfrac{x^2}{25} + \dfrac{y^2}{9} = 1$, so $a = 5$, $b = 3$.

Area $= \pi a b =$ **$15\pi$**.
:::

:::question{title="6. Part of a circle" exam="JEE Main level"}
Find the area of the region in the first quadrant that lies inside the circle $x^2 + y^2 = 16$ and to the right of the line $x = 2$.

---

$A = \displaystyle\int_2^4 \sqrt{16 - x^2}\,dx = \left[\frac{x}{2}\sqrt{16 - x^2} + 8\sin^{-1}\frac{x}{4}\right]_2^4$

At $x = 4$: $0 + 8 \cdot \dfrac{\pi}{2} = 4\pi$. At $x = 2$: $\sqrt{12} + 8 \cdot \dfrac{\pi}{6} = 2\sqrt3 + \dfrac{4\pi}{3}$.

$A =$ **$\dfrac{8\pi}{3} - 2\sqrt3$** $\approx 4.91$.
:::

## Area between curves (exam extra)

:::question{title="7. Parabola and line" exam="JEE Main level"}
Find the area of the region enclosed by $y = x^2$ and $y = 2x$.

---

$x^2 = 2x$ gives $x = 0, 2$. On $[0, 2]$ the line is on top (at $x = 1$: $2 > 1$).

$A = \displaystyle\int_0^2 (2x - x^2)\,dx = 4 - \frac83 =$ **$\dfrac43$**.
:::

:::question{title="8. Right minus left" exam="JEE Main level"}
Find the area of the region enclosed by $y^2 = 4x$ and $y = 2x - 4$.

---

Write both as $x$ in terms of $y$: $x = \dfrac{y^2}{4}$ and $x = \dfrac{y + 4}{2}$. They meet where $y^2 = 2y + 8$: $y = -2, 4$. The line is on the right.

$A = \displaystyle\int_{-2}^{4} \left(\frac{y + 4}{2} - \frac{y^2}{4}\right) dy = \left[\frac{y^2}{4} + 2y - \frac{y^3}{12}\right]_{-2}^{4}$

$= \dfrac{20}{3} - \left(-\dfrac73\right) =$ **9**.
:::

:::question{title="9. From inequalities" exam="JEE Main level"}
Find the area of the region $\{(x, y) : x^2 \le y \le 4 - x^2\}$.

---

The curves meet where $x^2 = 4 - x^2$: $x = \pm\sqrt2$. The top curve is $y = 4 - x^2$.

$A = \displaystyle\int_{-\sqrt2}^{\sqrt2} (4 - 2x^2)\,dx = 2\left[4x - \frac{2x^3}{3}\right]_0^{\sqrt2} = 2\left(4\sqrt2 - \frac{4\sqrt2}{3}\right)$

$A =$ **$\dfrac{16\sqrt2}{3}$** $\approx 7.54$.
:::

:::question{title="10. Find the line" exam="JEE Main level"}
The area enclosed by $y = x^2$ and $y = kx$ ($k > 0$) is $\dfrac92$. Find $k$.

---

They meet at $x = 0$ and $x = k$, with the line on top.

$A = \displaystyle\int_0^k (kx - x^2)\,dx = \frac{k^3}{2} - \frac{k^3}{3} = \frac{k^3}{6}$

$\dfrac{k^3}{6} = \dfrac92$ gives $k^3 = 27$, so $k =$ **3**.
:::

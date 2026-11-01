---
title: "Quadratic Equations: Quick Practice"
type: practice
chapter: c10.mathematics.quadratic-equations
order: 4
---

Try each question first, then tap **Show answer**.

## Spotting and factorising

:::question{title="1. Is it quadratic?" exam="Board level"}
Check whether $(x - 1)^3 = x^3 + 2x$ is a quadratic equation.

---

$(x - 1)^3 = x^3 - 3x^2 + 3x - 1$. So $x^3 - 3x^2 + 3x - 1 = x^3 + 2x$.

The $x^3$ terms cancel: $-3x^2 + x - 1 = 0$, that is $3x^2 - x + 1 = 0$.

**Yes**, it is quadratic ($a = 3 \ne 0$).
:::

:::question{title="2. Splitting the middle term" exam="Board level"}
Solve by factorisation: $6x^2 - 7x - 3 = 0$.

---

$ac = -18$. Two numbers with product $-18$ and sum $-7$: $-9$ and $2$.

$6x^2 - 9x + 2x - 3 = 3x(2x - 3) + 1(2x - 3) = (3x + 1)(2x - 3)$

The roots are **$\dfrac32$ and $-\dfrac13$**.
:::

:::question{title="3. With surds" exam="Board level"}
Solve by factorisation: $\sqrt3\,x^2 + 10x + 7\sqrt3 = 0$.

---

$ac = \sqrt3 \times 7\sqrt3 = 21$. Two numbers with product 21 and sum 10: 7 and 3.

$\sqrt3\,x^2 + 7x + 3x + 7\sqrt3 = x(\sqrt3\,x + 7) + \sqrt3(\sqrt3\,x + 7)$

$= (x + \sqrt3)(\sqrt3\,x + 7)$

The roots are **$-\sqrt3$ and $-\dfrac{7}{\sqrt3} = -\dfrac{7\sqrt3}{3}$**.
:::

## Formula and discriminant

:::question{title="4. Using the formula" exam="Board level"}
Solve $2x^2 + 4x - 3 = 0$ by the quadratic formula.

---

$a = 2$, $b = 4$, $c = -3$. $D = 16 - 4(2)(-3) = 16 + 24 = 40$.

$x = \dfrac{-4 \pm \sqrt{40}}{4} = \dfrac{-4 \pm 2\sqrt{10}}{4}$

So $x =$ **$\dfrac{-2 \pm \sqrt{10}}{2}$**.
:::

:::question{title="5. Nature of roots" exam="Board level"}
Find the nature of the roots of $9x^2 - 6\sqrt2\,x + 2 = 0$. If real roots exist, find them.

---

$D = (-6\sqrt2)^2 - 4(9)(2) = 72 - 72 = 0$. **Two equal real roots.**

Each root $= -\dfrac{b}{2a} = \dfrac{6\sqrt2}{18} =$ **$\dfrac{\sqrt2}{3}$**.
:::

:::question{title="6. Equal roots" exam="Board level"}
Find $k$ so that $kx^2 + kx + 1 = 0$ has two equal roots.

---

$D = k^2 - 4(k)(1) = k(k - 4) = 0$, so $k = 0$ or $k = 4$.

$k = 0$ makes the equation $1 = 0$, which is not quadratic. So **$k = 4$** (the equation $4x^2 + 4x + 1 = 0$ has both roots $-\frac12$).
:::

:::question{title="7. Real roots" exam="Board level"}
For what values of $k$ does $x^2 + 4x + k = 0$ have real roots?

---

Real roots need $D \ge 0$: $16 - 4k \ge 0$, so $4k \le 16$.

**$k \le 4$.** (At $k = 4$ the roots are equal; for $k < 4$ they are distinct.)
:::

## Word problems

:::question{title="8. Right triangle" exam="Board level"}
The hypotenuse of a right triangle is 25 cm. The other two sides differ by 17 cm. Find them.

---

Shorter side $x$ cm, other side $(x + 17)$ cm. By Pythagoras: $x^2 + (x + 17)^2 = 625$.

$2x^2 + 34x + 289 - 625 = 0$, so $x^2 + 17x - 168 = 0$, and $(x + 24)(x - 7) = 0$.

$x = -24$ is rejected, because a length cannot be negative. The sides are **7 cm and 24 cm**.
:::

:::question{title="9. A cycle ride" exam="Board level"}
A cyclist rides 60 km at a uniform speed. If her speed were 5 km/h more, she would take 1 hour less. Find her speed.

---

Speed $x$ km/h. Then $\dfrac{60}{x} - \dfrac{60}{x + 5} = 1$.

Multiply by $x(x + 5)$: $60(x + 5) - 60x = x(x + 5)$, so $x^2 + 5x - 300 = 0$.

$(x + 20)(x - 15) = 0$. Speed cannot be negative, so the speed is **15 km/h** (check: 4 h at 15 km/h, 3 h at 20 km/h).
:::

:::question{title="10. Is it possible?" exam="Board level"}
Can a rectangular plot have a perimeter of 30 m and an area of 60 m²?

---

Length + breadth $= 15$. Breadth $x$, length $15 - x$: $x(15 - x) = 60$, so $x^2 - 15x + 60 = 0$.

$D = 225 - 240 = -15 < 0$. No real roots, so **it is not possible**.
:::

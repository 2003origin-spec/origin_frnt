---
title: "3D Geometry (Intro): Quick Practice"
type: practice
chapter: c11.mathematics.introduction-to-three-dimensional-geometry
order: 4
---

Try each question first, then tap **Show answer**.

## Coordinates and octants

:::question{title="1. Octant and foot" exam="JEE Main level"}
For $P(-3, 4, -5)$, name the octant of P and the foot of the perpendicular from P to the ZX-plane.

---

Signs $(-, +, -)$: octant **VI** (X′OYZ′).

On the ZX-plane $y = 0$, so the foot is **$(-3, 0, -5)$**.
:::

:::question{title="2. Three distances" exam="JEE Main level"}
For $P(3, -4, 12)$, find its distance from (a) the origin, (b) the XY-plane, (c) the x-axis.

---

(a) $\sqrt{9 + 16 + 144} = \sqrt{169} =$ **13**.

(b) $|z| =$ **12**.

(c) The foot on the x-axis is $(3, 0, 0)$, so the distance is $\sqrt{y^2 + z^2} = \sqrt{16 + 144} = \sqrt{160} =$ **$4\sqrt{10}$**.
:::

## Distance formula

:::question{title="3. Unknown coordinate" exam="JEE Main level"}
The distance between $(2, k, 1)$ and $(5, 3, -5)$ is 7. Find $k$.

---

$3^2 + (3 - k)^2 + (-6)^2 = 49$, so $(3 - k)^2 = 4$ and $3 - k = \pm 2$.

**$k = 1$ or $k = 5$.** Both work.
:::

:::question{title="4. Type of triangle" exam="JEE Main level"}
What kind of triangle has vertices $A(1, 1, 1)$, $B(3, 3, 2)$ and $C(3, 0, -1)$? Find its area.

---

$AB^2 = 4 + 4 + 1 = 9$, $AC^2 = 4 + 1 + 4 = 9$, $BC^2 = 0 + 9 + 9 = 18$.

$AB = AC$ and $AB^2 + AC^2 = BC^2$: a **right-angled isosceles triangle, right angle at A**.

Area $= \tfrac12 \times 3 \times 3 =$ **$\tfrac92$ square units**.
:::

:::question{title="5. Collinear?" exam="JEE Main level"}
Are $A(-1, 2, 3)$, $B(1, 3, 5)$ and $C(5, 5, 9)$ collinear? If yes, which point is in the middle?

---

$AB = \sqrt{4 + 1 + 4} = 3$, $BC = \sqrt{16 + 4 + 16} = 6$, $AC = \sqrt{36 + 9 + 36} = 9$.

$AB + BC = AC$, so **yes, collinear, with B between A and C**.
:::

## Locus

:::question{title="6. Equidistant points" exam="JEE Main level"}
Find the equation of the set of points equidistant from $A(2, -1, 3)$ and $B(0, 1, -1)$.

---

$PA^2 = PB^2$:
$(x - 2)^2 + (y + 1)^2 + (z - 3)^2 = x^2 + (y - 1)^2 + (z + 1)^2$.

The squares cancel: $-4x + 2y - 6z + 14 = -2y + 2z + 2$, so $-4x + 4y - 8z + 12 = 0$.

**$x - y + 2z = 3$.** (Check: the midpoint $(1, 0, 1)$ satisfies it.)
:::

:::question{title="7. Twice as far" exam="JEE Main level"}
P moves so that its distance from the origin is twice its distance from $A(3, 0, 0)$. Find the equation of its path.

---

$x^2 + y^2 + z^2 = 4\left[(x - 3)^2 + y^2 + z^2\right]$

$0 = 3x^2 + 3y^2 + 3z^2 - 24x + 36$

**$x^2 + y^2 + z^2 - 8x + 12 = 0$.** (Beyond the syllabus: this is a sphere with centre $(4, 0, 0)$ and radius 2.)
:::

## Section formula and centroid

:::question{title="8. Cut by the YZ-plane" exam="JEE Main level"}
In what ratio does the YZ-plane divide the join of $A(-2, 4, 7)$ and $B(3, -5, 8)$? Find the point.

---

Ratio $-x_1 : x_2 = 2 : 3$, internal.

$y = \dfrac{2(-5) + 3(4)}{5} = \dfrac25$ and $z = \dfrac{2(8) + 3(7)}{5} = \dfrac{37}{5}$.

**$2 : 3$ internally, at $\left(0, \tfrac25, \tfrac{37}{5}\right)$.**
:::

:::question{title="9. Fourth vertex" exam="JEE Main level"}
$A(1, 2, -1)$, $B(3, -1, 2)$ and $C(4, 0, 5)$ are three vertices of parallelogram ABCD. Find D.

---

The diagonals AC and BD have the same midpoint, so $D = A + C - B$.

$D = (1 + 4 - 3,\ 2 + 0 + 1,\ -1 + 5 - 2) =$ **$(2, 3, 2)$**.
:::

:::question{title="10. Centroid and median" exam="JEE Main level"}
The centroid of triangle ABC is $G(2, 0, 3)$, with $A(1, 2, 3)$ and $B(3, -4, 5)$. Find C and the length of the median from C.

---

$C = 3G - A - B = (6 - 1 - 3,\ 0 - 2 + 4,\ 9 - 3 - 5) = (2, 2, 1)$.

Midpoint of AB: $M = (2, -1, 4)$. $CM = \sqrt{0 + 9 + 9}$.

**$C = (2, 2, 1)$, median $= 3\sqrt2$.**
:::

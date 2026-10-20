---
title: "Coordinate Geometry: Important Points and Traps"
type: key_points
chapter: c10.mathematics.coordinate-geometry
order: 3
---

## What is in the current book

:::remember
The current NCERT chapter has only:
- the **distance formula** (Exercise 7.1);
- the **section formula** for internal division and the **mid-point** formula (Exercise 7.2).
:::

:::trap
The **area of a triangle** from its vertices is **not** in the current book. That section was removed. Older books and guides still have it, and also the **centroid**. They are not part of this chapter now. To show that points are collinear, use the **distance method**, as the book does.
:::

## Distance formula

- Distance is **never negative**. Take only the positive square root.
- $(x_2 - x_1)^2$ and $(x_1 - x_2)^2$ are the same. You can subtract in either order.
- Two points on the $x$-axis: just subtract, $AB = |x_2 - x_1|$.
- The distance of $(x, y)$ from the $y$-axis is $|x|$, and from the $x$-axis is $|y|$. It is **not** $x$ itself when $x$ is negative.

:::trap
**Watch the minus signs.** For $(-5, 7)$ and $(-1, 3)$:

$x_2 - x_1 = -1 - (-5) = 4$, not $-6$.

Put every negative number in brackets before you subtract.
:::

:::trap
When an unknown is inside a square, you usually get **two** answers. $(y + 3)^2 = 36$ gives $y + 3 = 6$ or $y + 3 = -6$, so $y = 3$ or $y = -9$. Keep both unless the question rules one out.
:::

:::tip
Work with **squares of distances** as long as you can. To compare sides or test for a right angle, $AB^2$, $BC^2$ and $AC^2$ are enough. Take square roots only at the end.
:::

## Triangles and quadrilaterals

:::trap
**Four equal sides do not make a square.** A rhombus also has four equal sides. You must also check that the diagonals are equal (or that one angle is $90^\circ$).
:::

:::trap
**Equal diagonals alone do not make a rectangle.** First check that both pairs of opposite sides are equal (the shape is a parallelogram). Then equal diagonals make it a rectangle.
:::

- For a right triangle, the longest side is the **hypotenuse**. The right angle is opposite to it.
- An isosceles right triangle has two equal sides, and $a^2 + a^2 = (\text{longest side})^2$.
- If the four "vertices" give $AB + BC = AC$ for some three of them, those three are collinear and there is **no** quadrilateral (NCERT Exercise 7.1, Q6).

:::trap
**Collinear test:** the two **shorter** distances must add up to the **longest**. Comparing the wrong pair (for example, longest + short = other short) proves nothing.
:::

## Section formula

:::tip
**Criss-cross rule.** In $\dfrac{m_1 x_2 + m_2 x_1}{m_1 + m_2}$, $m_1$ is the part next to $A$, but it multiplies the coordinate of $B$. $m_2$ multiplies the coordinate of $A$.

Quick check: the point is **nearer** to the end whose part of the ratio is **smaller**. For $1 : 2$, it is nearer to $A$.
:::

:::trap
"$P$ divides $AB$ in $m_1 : m_2$" means $AP : PB = m_1 : m_2$. The order of $A$ and $B$ matters. $P$ dividing $BA$ in $1 : 2$ is the same point as $P$ dividing $AB$ in $2 : 1$.
:::

:::trap
"$AP = \dfrac37 AB$" means $AP : PB = 3 : 4$, **not** $3 : 7$. The parts of the ratio add up to the whole.
:::

- If you take the ratio as $k : 1$ and get a **positive** $k$, $P$ is between $A$ and $B$. If $k$ comes out **negative**, $P$ is on the line $AB$ but **outside** the segment (beyond the Class 10 book). NCERT's "Note to the reader" calls this **external** division. Its formula comes in higher classes.
- A point on the $x$-axis has $y = 0$. A point on the $y$-axis has $x = 0$. Use the **zero** coordinate to find $k$, then the other one to find the point.
- After finding $k$ from one coordinate, check it with the other. If it fails, the three points are not collinear.

:::remember
- Mid-point = the **average** of the coordinates.
- Points of trisection: ratios $1 : 2$ and $2 : 1$.
- Parallelogram $ABCD$ taken in order: $x_A + x_C = x_B + x_D$, and the same for $y$.
- Centre of a circle = mid-point of any diameter.
:::

:::trap
"Vertices **taken in order**" matters. In parallelogram $ABCD$, the diagonals are $AC$ and $BD$, not $AB$ and $CD$. Pairing the wrong vertices gives a wrong fourth vertex.
:::

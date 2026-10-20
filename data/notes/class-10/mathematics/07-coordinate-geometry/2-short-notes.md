---
title: "Coordinate Geometry: Short Notes"
type: short_notes
chapter: c10.mathematics.coordinate-geometry
order: 2
---

## 1. What this chapter covers

The current NCERT chapter has two main formulas:
- the **distance formula** (Section 7.2);
- the **section formula** for internal division, with the **mid-point** as a special case (Section 7.3).

Coordinate geometry lets us study geometry with algebra. A shape becomes a set of numbers, and we check its properties by calculation.

## 2. Coordinates: a quick recap (from Class 9)

- A point is written $(x, y)$. The $x$-coordinate (**abscissa**) tells how far the point is from the $y$-axis. The $y$-coordinate (**ordinate**) tells how far it is from the $x$-axis. The sign tells the side: for example, a negative $x$ means the point is to the left of the $y$-axis.
- A point on the $x$-axis is $(x, 0)$. A point on the $y$-axis is $(0, y)$.
- Signs in the four quadrants:

| Quadrant | $x$ | $y$ |
|---|---|---|
| I | + | + |
| II | − | + |
| III | − | − |
| IV | + | − |

## 3. Distance formula

- **Idea:** join $P(x_1, y_1)$ and $Q(x_2, y_2)$. Draw lines parallel to the axes to make a right triangle. Its two short sides are $x_2 - x_1$ and $y_2 - y_1$ (take them as positive lengths). By the Pythagoras theorem:

$$PQ = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

- Distance is never negative, so we take only the positive square root.
- The order of the points does not matter. Squaring removes the sign.
- From the origin: $OP = \sqrt{x^2 + y^2}$.
- If both points are on the $x$-axis (or on any horizontal line), just subtract the $x$-coordinates and drop any minus sign: $PQ = |x_2 - x_1|$. Same idea for a vertical line.

:::example{title="Two quadrants"}
$P(6, 4)$ and $Q(-5, -3)$:

$PQ = \sqrt{(6 + 5)^2 + (4 + 3)^2} = \sqrt{121 + 49} = \sqrt{170}$ units.
:::

## 4. Using the distance formula

**Type of triangle.** Find all three sides.
- All three equal: **equilateral**.
- Two equal: **isosceles**.
- All different: **scalene**.
- If the squares of the two shorter sides add up to the square of the longest side, it is a **right** triangle (converse of the Pythagoras theorem).

**Type of quadrilateral.** Find the four sides **and** the two diagonals.

| Shape | Sides | Diagonals |
|---|---|---|
| Square | all 4 equal | equal |
| Rhombus | all 4 equal | not equal |
| Rectangle | opposite sides equal | equal |
| Parallelogram | opposite sides equal | not equal |

Read the table from the top. The first row that fits gives the name. (A square also has equal opposite sides, but "square" is the better name.)

:::example{title="A rhombus"}
$A(0, 0)$, $B(3, 1)$, $C(4, 4)$, $D(1, 3)$.

Each side is $\sqrt{10}$. The diagonals are $AC = \sqrt{32}$ and $BD = \sqrt{8}$, which are not equal. So $ABCD$ is a **rhombus**, not a square.

Area $= \dfrac12 \times \sqrt{32} \times \sqrt{8} = \dfrac12 \times 16 = 8$ square units.
:::

**Collinear points.** Find $AB$, $BC$ and $AC$. If the sum of the two shorter ones equals the longest, the three points are on one line. NCERT Example 3 uses this method (desks at $A(3, 1)$, $B(6, 4)$, $C(8, 6)$: $3\sqrt2 + 2\sqrt2 = 5\sqrt2$).

**Equidistant point.** "$P$ is equidistant from $A$ and $B$" means $PA = PB$. Square both sides, $PA^2 = PB^2$, and the square roots go away.
- $P(x, y)$ unknown: you get a relation between $x$ and $y$. Its graph is the **perpendicular bisector** of $AB$.
- $P$ on the $x$-axis: take $P(x, 0)$. On the $y$-axis: take $P(0, y)$.

:::example{title="Equidistant relation"}
$P(x, y)$ is equidistant from $A(2, 1)$ and $B(4, 5)$:

$(x - 2)^2 + (y - 1)^2 = (x - 4)^2 + (y - 5)^2$

The $x^2$ and $y^2$ cancel: $-4x - 2y + 5 = -8x - 10y + 41$, so $4x + 8y = 36$, that is $x + 2y = 9$.
:::

## 5. Section formula

$P(x, y)$ divides the segment joining $A(x_1, y_1)$ and $B(x_2, y_2)$ **internally** in the ratio $m_1 : m_2$. This means $P$ is on the segment and $PA : PB = m_1 : m_2$.

$$x = \frac{m_1 x_2 + m_2 x_1}{m_1 + m_2}$$
$$y = \frac{m_1 y_2 + m_2 y_1}{m_1 + m_2}$$

- **Proof idea:** draw perpendiculars to the $x$-axis and lines parallel to it. Two triangles are similar (AA criterion), so their sides are in the ratio $m_1 : m_2$.
- **Ratio $k : 1$:** put $k = \dfrac{m_1}{m_2}$. Then $x = \dfrac{kx_2 + x_1}{k + 1}$ and $y = \dfrac{ky_2 + y_1}{k + 1}$.
- **Mid-point** (ratio $1 : 1$): $\left(\dfrac{x_1 + x_2}{2}, \dfrac{y_1 + y_2}{2}\right)$.

:::example{title="Finding the point"}
Divide the join of $(4, -3)$ and $(8, 5)$ in the ratio $3 : 1$ (NCERT Example 6):

$x = \dfrac{3(8) + 1(4)}{4} = 7$ and $y = \dfrac{3(5) + 1(-3)}{4} = 3$. The point is $(7, 3)$.
:::

## 6. Finding the ratio

Take the ratio as $k : 1$. Put the known coordinate into the formula and solve for $k$. Then check with the other coordinate.

:::example{title="Finding the ratio"}
In what ratio does $(0, -1)$ divide the join of $A(2, -3)$ and $B(-6, 5)$?

$x$: $\dfrac{-6k + 2}{k + 1} = 0$, so $k = \dfrac13$. The ratio is $1 : 3$.

Check $y$: $\dfrac{5\left(\frac13\right) - 3}{\frac13 + 1} = \dfrac{-\frac43}{\frac43} = -1$. Correct.
:::

**Where an axis cuts the segment.**
- The point on the $y$-axis has $x = 0$. Put $x = 0$ and solve for $k$.
- The point on the $x$-axis has $y = 0$. Put $y = 0$ and solve for $k$.

:::example{title="Cut by the y-axis"}
$A(-2, 4)$, $B(6, -8)$. Put $x = 0$: $\dfrac{6k - 2}{k + 1} = 0$, so $k = \dfrac13$, a ratio of $1 : 3$.

Then $y = \dfrac{-8\left(\frac13\right) + 4}{\frac43} = 1$. The point is $(0, 1)$.
:::

## 7. Points that cut a segment into equal parts

- **Mid-point:** 2 equal parts, ratio $1 : 1$.
- **Points of trisection** (3 equal parts): $P$ divides $AB$ in $1 : 2$ and $Q$ in $2 : 1$. Or find $P$, then $Q$ is the mid-point of $PB$.
- **4 equal parts:** first find the mid-point $M$ of $AB$. Then find the mid-points of $AM$ and $MB$.

## 8. Shapes and the mid-point

- **Parallelogram** $ABCD$ (vertices taken in order): the diagonals bisect each other, so the mid-point of $AC$ = the mid-point of $BD$. This gives a missing vertex.
- **Circle:** the centre is the mid-point of every diameter.

:::remember
The section formula in this chapter is only for **internal** division. NCERT's "Note to the reader" says that a point outside the segment, on the line $AB$, divides it **externally**. You will study that case in higher classes.
:::

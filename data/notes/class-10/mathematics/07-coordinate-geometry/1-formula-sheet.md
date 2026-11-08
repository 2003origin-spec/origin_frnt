---
title: "Coordinate Geometry: Formula Sheet"
type: formula_sheet
chapter: c10.mathematics.coordinate-geometry
order: 1
---

## Points and axes

:::formula{title="Points on the axes"}
$$\text{On the x-axis: } (x, 0)$$
$$\text{On the y-axis: } (0, y)$$
The origin is $O(0, 0)$. The $x$-coordinate is also called the **abscissa**. The $y$-coordinate is the **ordinate**.
:::

:::formula{title="Distance from the axes"}
$$\text{from the y-axis} = |x|$$
$$\text{from the x-axis} = |y|$$
For the point $P(x, y)$. A distance is never negative. Example: $(-3, 5)$ is 3 units from the $y$-axis and 5 units from the $x$-axis.
:::

## Distance formula

:::formula{title="Distance between two points"}
$$PQ = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$
$P(x_1, y_1)$ and $Q(x_2, y_2)$ = any two points. Take only the **positive** square root.

The order does not matter, because $(x_1 - x_2)^2 = (x_2 - x_1)^2$.
:::

:::formula{title="Distance from the origin"}
$$OP = \sqrt{x^2 + y^2}$$
$O(0, 0)$ = origin, $P(x, y)$ = any point.
:::

:::formula{title="Two points on a horizontal or vertical line"}
Same $y$ (line parallel to the $x$-axis):
$$PQ = |x_2 - x_1|$$
Same $x$ (line parallel to the $y$-axis):
$$PQ = |y_2 - y_1|$$
:::

:::example{title="Distance"}
$A(1, -2)$ and $B(7, 6)$: $AB = \sqrt{6^2 + 8^2} = \sqrt{100} = 10$ units.
:::

## Section formula (internal division)

:::formula{title="Section formula"}
$P(x, y)$ lies on the segment joining $A(x_1, y_1)$ and $B(x_2, y_2)$, and $PA : PB = m_1 : m_2$. Then
$$x = \frac{m_1 x_2 + m_2 x_1}{m_1 + m_2}$$
$$y = \frac{m_1 y_2 + m_2 y_1}{m_1 + m_2}$$
Only for **internal** division: $P$ is **between** $A$ and $B$, and $m_1, m_2$ are positive.
:::

:::formula{title="Ratio k : 1"}
$$x = \frac{k x_2 + x_1}{k + 1}$$
$$y = \frac{k y_2 + y_1}{k + 1}$$
Here $k = \dfrac{m_1}{m_2}$, a positive number. Use this form when the ratio is unknown: you solve for one letter $k$, not two.
:::

:::formula{title="Mid-point"}
$$x = \frac{x_1 + x_2}{2}$$
$$y = \frac{y_1 + y_2}{2}$$
The section formula with the ratio $1 : 1$.
:::

:::formula{title="Points of trisection"}
$P$ and $Q$ cut $AB$ into three equal parts. $P$ (nearer to $A$) divides $AB$ in $1 : 2$, and $Q$ in $2 : 1$.
$$P = \left(\frac{2x_1 + x_2}{3}, \frac{2y_1 + y_2}{3}\right)$$
$$Q = \left(\frac{x_1 + 2x_2}{3}, \frac{y_1 + 2y_2}{3}\right)$$
:::

## Shapes

:::formula{title="Right angle test"}
$$AB^2 + BC^2 = AC^2$$
If this holds, then $\angle B = 90^\circ$. This is the converse of the Pythagoras theorem. The right angle is at the vertex **between** the two shorter sides.
:::

:::formula{title="Collinear points (distance method)"}
$$AB + BC = AC$$
Then $A$, $B$, $C$ lie on one line, with $B$ between $A$ and $C$. If the two shorter distances add up to **more** than the longest, the points form a triangle.
:::

:::formula{title="Parallelogram ABCD (taken in order)"}
The diagonals bisect each other:
$$\text{mid-point of } AC = \text{mid-point of } BD$$
So $x_A + x_C = x_B + x_D$ and $y_A + y_C = y_B + y_D$.
:::

:::formula{title="Area of a rhombus"}
$$\text{Area} = \frac{1}{2} \times d_1 \times d_2$$
$d_1, d_2$ = lengths of the two diagonals (find them with the distance formula). This is the hint given in NCERT Exercise 7.2.
:::

:::formula{title="Centre of a circle"}
$$\text{centre} = \text{mid-point of a diameter}$$
If the centre $C$ and one end $A$ are known, the other end is $B = (2x_C - x_A,\ 2y_C - y_A)$.
:::

---
title: "3D Geometry (Intro): Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.introduction-to-three-dimensional-geometry
order: 1
---

The current NCERT chapter (reprint 2025-26) covers coordinates, octants and the distance formula. The section formula was **removed from this chapter**. NCERT now teaches it in Class 12 Vector Algebra (Section 10.5.3, in vector form), and the JEE Main syllabus lists it, so it is at the end of this sheet.

## Points on the axes and planes

:::formula{title="Points on the axes"}
$$\text{x-axis: } (x, 0, 0)$$
$$\text{y-axis: } (0, y, 0)$$
$$\text{z-axis: } (0, 0, z)$$
The origin is $O(0, 0, 0)$.
:::

:::formula{title="Points in the coordinate planes"}
$$\text{XY-plane: } (x, y, 0)$$
$$\text{YZ-plane: } (0, y, z)$$
$$\text{ZX-plane: } (x, 0, z)$$
The coordinate that is **missing** from the plane's name is the one that is zero.
:::

## Octants

The three coordinate planes cut space into **8 octants**. NCERT numbers them I to VIII:

| Octant | NCERT name | Signs of $(x, y, z)$ |
|---|---|---|
| I | XOYZ | $(+, +, +)$ |
| II | X′OYZ | $(-, +, +)$ |
| III | X′OY′Z | $(-, -, +)$ |
| IV | XOY′Z | $(+, -, +)$ |
| V | XOYZ′ | $(+, +, -)$ |
| VI | X′OYZ′ | $(-, +, -)$ |
| VII | X′OY′Z′ | $(-, -, -)$ |
| VIII | XOY′Z′ | $(+, -, -)$ |

Octants V to VIII are I to IV with $z$ made negative. A point with any coordinate 0 lies on a plane, so it is in **no** octant.

## Distances

:::formula{title="Distance from the coordinate planes"}
For $P(x, y, z)$:
$$\text{from the YZ-plane} = |x|$$
$$\text{from the ZX-plane} = |y|$$
$$\text{from the XY-plane} = |z|$$
NCERT calls $x, y, z$ the distances from these planes; with signs, they are signed distances.
:::

:::formula{title="Distance between two points"}
For $P(x_1, y_1, z_1)$ and $Q(x_2, y_2, z_2)$:
$$\begin{aligned} PQ^2 = {} &(x_2 - x_1)^2 + (y_2 - y_1)^2 \\ &+ (z_2 - z_1)^2 \end{aligned}$$
$PQ$ is the **positive** square root. The order of P and Q does not matter.
:::

:::formula{title="Distance from the origin"}
$$OP = \sqrt{x^2 + y^2 + z^2}$$
This is also the length of the diagonal of a box with edges $|x|, |y|, |z|$.
:::

:::formula{title="Distance from the axes (exam extra)"}
For $P(x, y, z)$ (not in NCERT; it is the distance from P to its foot on the axis, e.g. $(x, 0, 0)$):
$$\text{from the x-axis} = \sqrt{y^2 + z^2}$$
$$\text{from the y-axis} = \sqrt{z^2 + x^2}$$
$$\text{from the z-axis} = \sqrt{x^2 + y^2}$$
Drop the coordinate of the axis itself and use the other two.
:::

## Feet of perpendiculars and images

:::formula{title="Foot of the perpendicular from P(x, y, z)"}
$$\text{on the XY-plane: } (x, y, 0)$$
$$\text{on the x-axis: } (x, 0, 0)$$
Set the "other" coordinates to zero. The same idea works for every axis and plane. (NCERT's Fig 11.2 and 11.3 use these feet: M on the XY-plane, A on the x-axis.)
:::

:::formula{title="Mirror images of P(x, y, z) (exam extra)"}
$$\text{in the XY-plane: } (x, y, -z)$$
$$\text{in the x-axis: } (x, -y, -z)$$
$$\text{in the origin: } (-x, -y, -z)$$
In a plane, change the sign of the one coordinate not in the plane's name. In an axis, keep that axis's coordinate and change the other two. Not in NCERT; JEE Main tests it under "coordinates of a point in space".
:::

## Section formula (removed from this chapter)

Not in this Class 11 chapter any more. NCERT teaches it in Class 12 Vector Algebra (Section 10.5.3), and the JEE Main syllabus lists "section formula" under 3D geometry.

$P(x_1, y_1, z_1)$ and $Q(x_2, y_2, z_2)$; $m, n > 0$.

:::formula{title="Internal division in the ratio m : n"}
$$x = \frac{m x_2 + n x_1}{m + n}$$
$$y = \frac{m y_2 + n y_1}{m + n}$$
$$z = \frac{m z_2 + n z_1}{m + n}$$
$m$ is the part of the ratio next to P, but it multiplies the coordinates of **Q** (cross over). With ratio $k : 1$, $x = \dfrac{k x_2 + x_1}{k + 1}$ and so on.
:::

:::formula{title="External division in the ratio m : n"}
$$x = \frac{m x_2 - n x_1}{m - n}$$
Same pattern for $y$ and $z$. Needs $m \ne n$.
:::

:::formula{title="Midpoint"}
$$x = \frac{x_1 + x_2}{2}$$
$$y = \frac{y_1 + y_2}{2}$$
$$z = \frac{z_1 + z_2}{2}$$
:::

:::formula{title="Centroid of a triangle"}
For vertices $(x_1, y_1, z_1)$, $(x_2, y_2, z_2)$, $(x_3, y_3, z_3)$:
$$x = \frac{x_1 + x_2 + x_3}{3}$$
Same for $y$ and $z$. NCERT's Example 9 uses this. The centroid divides each median in the ratio $2 : 1$ from the vertex.
:::

:::formula{title="Centroid of a tetrahedron (exam extra)"}
$$x = \frac{x_1 + x_2 + x_3 + x_4}{4}$$
Same for $y$ and $z$. Not in NCERT; it follows from the section formula.
:::

:::formula{title="Where a coordinate plane cuts PQ"}
$$\text{YZ-plane divides PQ in } -x_1 : x_2$$
$$\text{ZX-plane: } -y_1 : y_2$$
$$\text{XY-plane: } -z_1 : z_2$$
A positive ratio means internal division (P and Q on opposite sides of the plane). A negative ratio means external.
:::

:::formula{title="Fourth vertex of a parallelogram ABCD"}
$$D = A + C - B$$
Add coordinates one by one. It comes from "the diagonals AC and BD bisect each other". The vertices must be taken in order A, B, C, D.
:::

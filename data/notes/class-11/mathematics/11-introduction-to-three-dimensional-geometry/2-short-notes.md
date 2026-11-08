---
title: "3D Geometry (Intro): Short Notes"
type: short_notes
chapter: c11.mathematics.introduction-to-three-dimensional-geometry
order: 2
---

## 1. Why three coordinates

- In a plane, two numbers fix a point. In space (a ball in the air, the tip of a ceiling fan) we need **three**: the distances from the floor and from two walls that meet at right angles.
- This chapter extends the $x$ and $y$ coordinates of Class 9–11 by one more, $z$. In Class 12 the same ideas continue with direction cosines and lines.

## 2. Axes and coordinate planes

- Take three planes that meet at a point O and are **mutually perpendicular**. They meet in three lines, X′OX, Y′OY and Z′OZ: the **x, y and z-axes**. The axes are also mutually perpendicular. O is the **origin**.
- The planes XOY, YOZ and ZOX are the **XY-plane, YZ-plane and ZX-plane**: the three **coordinate planes**.
- NCERT draws the XY-plane as the plane of the paper (think of it as horizontal) and the z-axis vertical.

Sign convention (NCERT):
- Above the XY-plane (towards OZ): $z > 0$. Below (towards OZ′): $z < 0$.
- To the right of the ZX-plane (towards OY): $y > 0$. To the left: $y < 0$.
- In front of the YZ-plane (towards OX): $x > 0$. Behind: $x < 0$.

## 3. Octants

- The three coordinate planes divide space into **8 parts**, called **octants**.
- NCERT names them XOYZ, X′OYZ, X′OY′Z, XOY′Z, XOYZ′, X′OYZ′, X′OY′Z′, XOY′Z′ and numbers them **I to VIII** in that order.
- The **signs** of the coordinates tell you the octant:

| Octants | $z$ | $(x, y)$ signs in order |
|---|---|---|
| I, II, III, IV | $+$ | $(+,+), (-,+), (-,-), (+,-)$ |
| V, VI, VII, VIII | $-$ | same order again |

So I to IV go round the XY-plane like the four quadrants, above it. V to VIII do the same below it.

:::example{title="Finding the octant"}
$(-3, 1, 2)$: signs $(-, +, +)$, so octant **II**. $(-3, 1, -2)$: signs $(-, +, -)$, so octant **VI**.
:::

## 4. Coordinates of a point

- **Way 1:** From P drop a perpendicular PM to the XY-plane. From M drop a perpendicular ML to the x-axis. Then $OL = x$, $LM = y$, $MP = z$.
- **Way 2:** Through P draw three planes parallel to the coordinate planes. They cut the axes at A, B, C. Then $OA = x$, $OB = y$, $OC = z$. The six planes make a box (a cuboid) with O and P at opposite corners.
- So $x$, $y$, $z$ are the (signed) perpendicular distances of P from the **YZ, ZX and XY-planes**. Note the matching: $x$ goes with the plane that does **not** contain the x-axis.
- Each point in space gives exactly one ordered triple $(x, y, z)$, and each triple gives exactly one point: a **one-to-one correspondence**.

| Where the point is | Its form |
|---|---|
| origin | $(0, 0, 0)$ |
| on the x-axis | $(x, 0, 0)$ |
| on the y-axis | $(0, y, 0)$ |
| on the z-axis | $(0, 0, z)$ |
| in the XY-plane | $(x, y, 0)$ |
| in the YZ-plane | $(0, y, z)$ |
| in the ZX-plane | $(x, 0, z)$ |

:::example{title="Corners of the box"}
If $P$ is $(2, 4, 5)$, the box corner F in the ZX-plane (where the $y$-distance is 0) is $(2, 0, 5)$. The corner on the x-axis is $(2, 0, 0)$.
:::

## 5. Distance between two points

- Through $P(x_1, y_1, z_1)$ and $Q(x_2, y_2, z_2)$ draw planes parallel to the coordinate planes. They make a box with PQ as a diagonal. Its edges are $|x_2 - x_1|$, $|y_2 - y_1|$, $|z_2 - z_1|$.
- Using Pythagoras twice (once on a face, once through the box):

$$\begin{aligned} PQ^2 = {} &(x_2 - x_1)^2 + (y_2 - y_1)^2 \\ &+ (z_2 - z_1)^2 \end{aligned}$$

- From the origin: $OP = \sqrt{x^2 + y^2 + z^2}$.

:::example{title="NCERT Example 3"}
$P(1, -3, 4)$, $Q(-4, 1, 2)$: $PQ^2 = 25 + 16 + 4 = 45$, so $PQ = 3\sqrt5$ units.
:::

## 6. Using the distance formula

**Collinear points.** Find all three distances. The points are collinear if the **largest** equals the **sum** of the other two (PQ + QR = PR means Q lies between P and R).

**Type of triangle.** Find the three squared lengths.
- Two equal: isosceles. Three equal: equilateral.
- Largest square = sum of the other two: right-angled (the right angle is opposite the longest side).

**Quadrilaterals.**
- Parallelogram: the diagonals **bisect each other** (same midpoint). NCERT's Example 7 checks that opposite sides are equal, and the Note after it gives this midpoint test. In space, the midpoint test is the safer one (see Traps).
- Rectangle: a parallelogram with **equal diagonals**.
- Rhombus: a parallelogram with all four sides equal. Square: a rhombus with equal diagonals.

**Set of points (locus).** Let $P = (x, y, z)$, write the condition with the distance formula, square, and simplify to an equation in $x, y, z$.
- Equal distances from A and B gives a **linear** equation in $x, y, z$. (Beyond the syllabus: this set is a plane. Planes are not in current NCERT or the JEE Main 2026 syllabus.)
- Conditions like $PA^2 + PB^2 = k^2$ or $PA = 2\,PB$ give an equation with $x^2 + y^2 + z^2$ (beyond the syllabus: usually a sphere).
- A sum of distances, $PA + PB = $ constant, needs squaring twice.

:::example{title="Equidistant points"}
$PA = PB$ for $A(3, 4, -5)$ and $B(-2, 1, 4)$. Square both sides; the $x^2, y^2, z^2$ terms cancel, leaving $10x + 6y - 18z - 29 = 0$.
:::

## 7. Section formula, midpoint, centroid

The rationalised NCERT removed this section from this chapter. NCERT now teaches the section formula in Class 12 Vector Algebra (Section 10.5.3, vector form), and the JEE Main syllabus lists it. This chapter's own Example 9 and Miscellaneous Exercise still use the centroid and midpoint.

- The point dividing PQ internally in $m : n$ has coordinates $\dfrac{m x_2 + n x_1}{m + n}$, and the same for $y$ and $z$. It works coordinate by coordinate, exactly like 2D.
- Externally: $\dfrac{m x_2 - n x_1}{m - n}$, with $m \ne n$.
- Midpoint: the average of the end points. Centroid of a triangle: the average of the three vertices. Centroid of a tetrahedron (exam extra, not in NCERT): the average of the four vertices.
- To find a ratio, take it as $k : 1$. Use the one coordinate you know (for example $x = 0$ on the YZ-plane) to find $k$. If $k > 0$ the division is internal; if $k < 0$, external.

:::example{title="Fourth vertex (NCERT Misc. Q1)"}
$A(3, -1, 2)$, $B(1, 2, -4)$, $C(-1, 1, 2)$. The diagonals of ABCD share a midpoint, so $D = A + C - B = (1, -2, 8)$.
:::
